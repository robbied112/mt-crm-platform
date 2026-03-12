# Sidekick BI - Deployment Guide

## Prerequisites

1. Firebase CLI installed: `npm install -g firebase-tools`
2. Logged in: `firebase login`
3. Project linked: `firebase use mt-crm-platform`

## Step 1: Deploy Firestore Security Rules

```bash
firebase deploy --only firestore:rules
```

This enforces tenant isolation, role-based access, and deny-by-default rules.

## Step 2: Set Stripe Secrets

Use Firebase Secret Manager (the modern approach) to store your Stripe keys:

```bash
firebase functions:secrets:set STRIPE_WEBHOOK_SECRET
```

When prompted, paste your webhook signing secret (starts with `whsec_`).

```bash
firebase functions:secrets:set STRIPE_SECRET_KEY
```

When prompted, paste your Stripe secret key (starts with `sk_live_` or `sk_test_`).

## Step 3: Deploy Cloud Functions (Stripe Webhook)

```bash
cd functions
npm install
cd ..
firebase deploy --only functions
```

After deploying, note the function URL shown in the output. With v2 functions it will look like:
`https://stripewebhook-<hash>-uc.a.run.app`

## Step 4: Configure Stripe Webhook

1. Go to Stripe Dashboard > Developers > Webhooks
2. Click "Add endpoint"
3. Enter the function URL from Step 3
4. Subscribe to these events:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
5. Copy the webhook signing secret (starts with `whsec_`)
6. If you haven't already set it, run:
   ```bash
   firebase functions:secrets:set STRIPE_WEBHOOK_SECRET
   ```
   Then redeploy:
   ```bash
   firebase deploy --only functions
   ```

## Step 5: Configure Stripe Customer Portal

1. Go to Stripe Dashboard > Settings > Customer Portal
2. Enable it and configure allowed actions (cancel, update payment method, etc.)
3. Copy the portal URL
4. Update `STRIPE_CONFIG.portalUrl` in `index.html` with the URL

## Step 6: Deploy Hosting (if using Firebase Hosting)

```bash
firebase deploy --only hosting
```

## Verify Everything Works

1. Open the app and sign in
2. Go to Settings > Billing
3. Click "Upgrade to Starter" or "Upgrade to Growth"
4. Complete a test purchase with Stripe test card (4242 4242 4242 4242)
5. Check Firestore > tenants > [your-tenant-id] for `subscription.status: "active"`
6. Verify the billing status updates in the app UI

## Switching Between Test and Live Stripe

In `index.html`, the `STRIPE_CONFIG` object has both sets of links.
Currently set to LIVE. To switch to test mode, swap the commented lines.

## Troubleshooting

### "firebase functions:config:set" deprecation error
This command is deprecated. Use `firebase functions:secrets:set` instead (see Step 2).

### Secrets not available to function
Make sure you redeploy after setting secrets: `firebase deploy --only functions`

### Function URL changed after upgrading to v2
v2 Cloud Functions use Cloud Run URLs instead of the old format. Update your Stripe webhook endpoint URL accordingly.
