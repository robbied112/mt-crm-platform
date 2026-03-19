/**
 * Billing Cloud Functions — Stripe Checkout + Customer Portal
 *
 * Three callable functions:
 *   createCheckoutSession  → generates Stripe Checkout URL for plan upgrade
 *   verifyCheckoutSession  → confirms payment + updates tenant subscription
 *   createBillingPortalSession → generates Stripe Customer Portal URL
 *
 * All use per-request Stripe client (matches stripe.js pattern).
 * Auth + tenant membership verified on every call.
 */
const {
  onCall,
  HttpsError,
  admin,
  db,
  stripeSecretKey,
  verifyTenantMembership,
} = require("./helpers");

// ─── Price IDs (configured via functions/.env) ──────────────────
// Set STRIPE_PRICE_ID_STARTER and STRIPE_PRICE_ID_GROWTH in functions/.env

// -------------------------------------------------------------------
// createCheckoutSession
// -------------------------------------------------------------------
// Called when a user clicks "Upgrade" in the UpgradeModal.
// Returns a Stripe Checkout URL that the frontend redirects to.
//
// Input:  { tenantId, planId, successUrl, cancelUrl }
// Output: { url: "https://checkout.stripe.com/..." }
// -------------------------------------------------------------------
const createCheckoutSession = onCall(
  { secrets: [stripeSecretKey], memory: "256MiB" },
  async (req) => {
    if (!req.auth) {
      throw new HttpsError("unauthenticated", "Must be signed in");
    }

    const { tenantId, planId, successUrl, cancelUrl, origin } = req.data;
    if (!tenantId || !planId) {
      throw new HttpsError("invalid-argument", "tenantId and planId are required");
    }

    await verifyTenantMembership(req.auth.uid, tenantId);

    const secretKey = stripeSecretKey.value();
    if (!secretKey) {
      console.error("STRIPE_SECRET_KEY not configured");
      throw new HttpsError("failed-precondition", "Billing not configured. Contact support.");
    }

    // Map planId to Stripe Price ID from environment variables
    const priceIdMap = {
      starter: process.env.STRIPE_PRICE_ID_STARTER,
      growth: process.env.STRIPE_PRICE_ID_GROWTH,
    };

    const priceId = priceIdMap[planId];
    if (!priceId) {
      throw new HttpsError("invalid-argument", `Unknown plan: ${planId}. Contact support.`);
    }

    const stripe = require("stripe")(secretKey);

    // Check if tenant already has a Stripe customer ID
    const tenantSnap = await db.collection("tenants").doc(tenantId).get();
    const existingCustomerId = tenantSnap.data()?.subscription?.customerId;

    try {
      const sessionParams = {
        mode: "subscription",
        payment_method_types: ["card"],
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: successUrl || `${origin || "https://app.crufolio.com"}/?upgraded=true`,
        cancel_url: cancelUrl || `${origin || "https://app.crufolio.com"}/settings`,
        client_reference_id: tenantId,
        metadata: { plan: planId },
      };

      // Reuse existing Stripe customer if available
      if (existingCustomerId) {
        sessionParams.customer = existingCustomerId;
      } else {
        sessionParams.customer_email = req.auth.token.email;
      }

      const session = await stripe.checkout.sessions.create(sessionParams);

      console.log(`Checkout session created for tenant ${tenantId}, plan: ${planId}`);
      return { url: session.url, sessionId: session.id };
    } catch (err) {
      console.error("Stripe checkout session creation failed:", err.message, { tenantId, planId });
      throw new HttpsError("internal", "Unable to create checkout session. Please try again.");
    }
  });

// -------------------------------------------------------------------
// verifyCheckoutSession
// -------------------------------------------------------------------
// Called after Stripe Checkout redirect to confirm payment and
// update tenant subscription immediately (bypasses webhook delay).
//
// Input:  { tenantId, sessionId }
// Output: { status: "active", plan: "growth" }
// -------------------------------------------------------------------
const verifyCheckoutSession = onCall(
  { secrets: [stripeSecretKey], memory: "256MiB" },
  async (req) => {
    if (!req.auth) {
      throw new HttpsError("unauthenticated", "Must be signed in");
    }

    const { tenantId, sessionId } = req.data;
    if (!tenantId || !sessionId) {
      throw new HttpsError("invalid-argument", "tenantId and sessionId are required");
    }

    await verifyTenantMembership(req.auth.uid, tenantId);

    const secretKey = stripeSecretKey.value();
    if (!secretKey) {
      throw new HttpsError("failed-precondition", "Billing not configured");
    }

    const stripe = require("stripe")(secretKey);

    try {
      const session = await stripe.checkout.sessions.retrieve(sessionId);

      // Verify session belongs to this tenant
      if (session.client_reference_id !== tenantId) {
        throw new HttpsError("permission-denied", "Session does not belong to this tenant");
      }

      if (session.payment_status !== "paid") {
        return { status: "pending", message: "Payment not yet completed" };
      }

      const plan = session.metadata?.plan;
      if (!plan) {
        console.error("Checkout session missing plan metadata", { sessionId, tenantId });
        throw new HttpsError("internal", "Payment verified but plan info missing. Please contact support.");
      }

      // Update tenant subscription immediately
      await db.collection("tenants").doc(tenantId).set({
        subscription: {
          status: "active",
          plan: plan,
          customerId: session.customer,
          subscriptionId: session.subscription,
          customerEmail: session.customer_details?.email || "",
          activatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
      }, { merge: true });

      console.log(`Tenant ${tenantId} verified and activated on ${plan} plan`);
      return { status: "active", plan };
    } catch (err) {
      if (err instanceof HttpsError) throw err;
      console.error("Stripe session verification failed:", err.message, { tenantId, sessionId });
      throw new HttpsError("internal", "Unable to verify payment. Contact support.");
    }
  });

// -------------------------------------------------------------------
// createBillingPortalSession
// -------------------------------------------------------------------
// Called when a user clicks "Manage Billing" in Settings.
// Returns a Stripe Customer Portal URL for card updates, invoices, cancellation.
//
// Input:  { tenantId, returnUrl }
// Output: { url: "https://billing.stripe.com/..." }
// -------------------------------------------------------------------
const createBillingPortalSession = onCall(
  { secrets: [stripeSecretKey], memory: "256MiB" },
  async (req) => {
    if (!req.auth) {
      throw new HttpsError("unauthenticated", "Must be signed in");
    }

    const { tenantId, returnUrl, origin } = req.data;
    if (!tenantId) {
      throw new HttpsError("invalid-argument", "tenantId is required");
    }

    await verifyTenantMembership(req.auth.uid, tenantId);

    // Get customer ID from tenant doc
    const tenantSnap = await db.collection("tenants").doc(tenantId).get();
    const customerId = tenantSnap.data()?.subscription?.customerId;

    if (!customerId) {
      throw new HttpsError(
        "failed-precondition",
        "No billing account found. Please upgrade first."
      );
    }

    const secretKey = stripeSecretKey.value();
    if (!secretKey) {
      throw new HttpsError("failed-precondition", "Billing not configured");
    }

    const stripe = require("stripe")(secretKey);

    try {
      const portalSession = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: returnUrl || `${origin || "https://app.crufolio.com"}/settings`,
      });

      console.log(`Billing portal session created for tenant ${tenantId}`);
      return { url: portalSession.url };
    } catch (err) {
      console.error("Stripe billing portal creation failed:", err.message, { tenantId, customerId });
      throw new HttpsError("internal", "Unable to open billing portal. Please try again.");
    }
  });

module.exports = {
  createCheckoutSession,
  verifyCheckoutSession,
  createBillingPortalSession,
};
