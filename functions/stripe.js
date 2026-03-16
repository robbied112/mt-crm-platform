const {
  functions,
  admin,
  db,
  stripeWebhookSecret,
  stripeSecretKey,
  findTenantByCustomerId,
} = require("./helpers");

// -------------------------------------------------------------------
// Stripe Webhook Handler  (v1 Cloud Function with Secret Manager)
// -------------------------------------------------------------------
// Listens for Stripe events and updates tenant subscription status
// in Firestore so the client app can read it.
//
// SETUP (one-time):
// 1. Set your Stripe secrets via Secret Manager:
//      firebase functions:secrets:set STRIPE_WEBHOOK_SECRET
//      firebase functions:secrets:set STRIPE_SECRET_KEY
//
// 2. In the Stripe Dashboard > Developers > Webhooks, create an
//    endpoint pointing to:
//      https://us-central1-mt-crm-platform.cloudfunctions.net/stripeWebhook
//    and subscribe to these events:
//      - checkout.session.completed
//      - customer.subscription.updated
//      - customer.subscription.deleted
//      - invoice.payment_succeeded
//      - invoice.payment_failed
//
// 3. Deploy:
//      firebase deploy --only functions
// -------------------------------------------------------------------

const stripeWebhook = functions
  .runWith({ secrets: [stripeWebhookSecret, stripeSecretKey] })
  .https.onRequest(async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).send("Method Not Allowed");
      return;
    }

    const webhookSecret = stripeWebhookSecret.value();
    const secretKey = stripeSecretKey.value();

    // Guard: require both secrets to be configured
    if (!webhookSecret || !secretKey) {
      console.error("Stripe secrets not configured. Set STRIPE_WEBHOOK_SECRET and STRIPE_SECRET_KEY.");
      res.status(500).send("Webhook not configured");
      return;
    }

    // Guard: require stripe-signature header
    const sig = req.headers["stripe-signature"];
    if (!sig) {
      console.error("Missing stripe-signature header");
      res.status(400).send("Missing stripe-signature header");
      return;
    }

    // Verify webhook signature
    let event;
    const stripe = require("stripe")(secretKey);
    try {
      event = stripe.webhooks.constructEvent(req.rawBody, sig, webhookSecret);
    } catch (err) {
      console.error("Webhook signature verification failed:", err.message);
      res.status(400).send("Webhook signature verification failed");
      return;
    }

    const eventType = event.type;
    console.log("Stripe event received:", eventType);

    try {
      switch (eventType) {
        // A customer completed checkout (new subscription)
        case "checkout.session.completed": {
          const session = event.data.object;
          const tenantId = session.client_reference_id;
          const customerEmail = session.customer_details?.email || session.customer_email || "";
          const customerId = session.customer;
          const subscriptionId = session.subscription;

          if (!tenantId) {
            console.warn("No client_reference_id (tenantId) on checkout session. Cannot update tenant.");
            break;
          }

          // Determine plan from line items or metadata
          const plan = session.metadata?.plan || "Growth";

          await db.collection("tenants").doc(tenantId).set({
            subscription: {
              status: "active",
              plan: plan,
              customerId: customerId,
              subscriptionId: subscriptionId,
              customerEmail: customerEmail,
              activatedAt: admin.firestore.FieldValue.serverTimestamp(),
              nextBilling: null, // Will be set by subscription.updated
            },
          }, { merge: true });

          console.log(`Tenant ${tenantId} activated on ${plan} plan`);
          break;
        }

        // Subscription updated (renewal, plan change, etc.)
        case "customer.subscription.updated": {
          const subscription = event.data.object;
          const tenantId = await findTenantByCustomerId(subscription.customer);

          if (!tenantId) {
            console.warn("No tenant found for customer:", subscription.customer);
            break;
          }

          const status = subscription.status === "active" ? "active" :
                         subscription.status === "trialing" ? "trial" :
                         subscription.status === "past_due" ? "past_due" : "inactive";

          const nextBilling = subscription.current_period_end
            ? new Date(subscription.current_period_end * 1000).toLocaleDateString()
            : null;

          const planName = subscription.items?.data?.[0]?.price?.nickname || "Growth";

          await db.collection("tenants").doc(tenantId).set({
            subscription: {
              status: status,
              plan: planName,
              subscriptionId: subscription.id,
              nextBilling: nextBilling,
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            },
          }, { merge: true });

          console.log(`Tenant ${tenantId} subscription updated: ${status}`);
          break;
        }

        // Subscription cancelled
        case "customer.subscription.deleted": {
          const subscription = event.data.object;
          const tenantId = await findTenantByCustomerId(subscription.customer);

          if (!tenantId) {
            console.warn("No tenant found for customer:", subscription.customer);
            break;
          }

          await db.collection("tenants").doc(tenantId).set({
            subscription: {
              status: "cancelled",
              cancelledAt: admin.firestore.FieldValue.serverTimestamp(),
            },
          }, { merge: true });

          console.log(`Tenant ${tenantId} subscription cancelled`);
          break;
        }

        // Payment succeeded (for logging / receipts)
        case "invoice.payment_succeeded": {
          const invoice = event.data.object;
          const tenantId = await findTenantByCustomerId(invoice.customer);

          if (tenantId) {
            await db.collection("tenants").doc(tenantId).collection("invoices").add({
              invoiceId: invoice.id,
              amount: invoice.amount_paid,
              currency: invoice.currency,
              status: "paid",
              paidAt: admin.firestore.FieldValue.serverTimestamp(),
              receiptUrl: invoice.hosted_invoice_url || "",
            });
            console.log(`Invoice recorded for tenant ${tenantId}: $${(invoice.amount_paid / 100).toFixed(2)}`);
          }
          break;
        }

        // Payment failed
        case "invoice.payment_failed": {
          const invoice = event.data.object;
          const tenantId = await findTenantByCustomerId(invoice.customer);

          if (tenantId) {
            await db.collection("tenants").doc(tenantId).set({
              subscription: {
                status: "past_due",
                lastPaymentFailed: admin.firestore.FieldValue.serverTimestamp(),
              },
            }, { merge: true });
            console.log(`Payment failed for tenant ${tenantId}`);
          }
          break;
        }

        default:
          console.log("Unhandled event type:", eventType);
      }

      res.status(200).json({ received: true });
    } catch (err) {
      console.error("Error processing webhook:", err);
      res.status(500).json({ error: "Webhook processing failed" });
    }
  });

module.exports = { stripeWebhook };
