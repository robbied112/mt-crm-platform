# Sidekick BI - Deployment Guide

## Prerequisites

1. Firebase CLI installed: `npm install -g firebase-tools`
2. Logged in: `firebase login`
3. Project linked: `firebase use <your-project-id>`

## Step 1: Deploy Firestore Security Rules

```bash
firebase deploy --only firestore:rules
```

This enforces tenant isolation, role-based access, and deny-by-default rules.

## Step 2: Deploy Cloud Functions (Stripe Webhook)

```bash
cd functions
npm install
cd ..
firebase deploy --only functions
```

After deploying, note the function URL (shown in the output). It will look like:
`https://us-central1-<project>.cloudfunctions.net/stripeWebhook`

## Step 3: Configure Stripe Webhook

1. Go to Stripe Dashboard > Developers > Webhooks
2. Click "Add endpoint"
3. Enter the function URL from Step 2
4. Subscribe to these events:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
5. Copy the webhook signing secret (starts with `whsec_`)
6. Set it in Firebase:
   ```bash
   firebase functions:config:set stripe.webhook_secret="whsec_..."
   firebase functions:config:set stripe.secret_key="sk_live_..."
   firebase deploy --only functions
   ```

## Step 4: Configure Stripe Customer Portal

1. Go to Stripe Dashboard > Settings > Customer Portal
2. Enable it and configure allowed actions (cancel, update payment method, etc.)
3. Copy the portal URL
4. Update `STRIPE_CONFIG.portalUrl` in `index.html` with the URL

## Step 5: Deploy Hosting (if using Firebase Hosting)

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
