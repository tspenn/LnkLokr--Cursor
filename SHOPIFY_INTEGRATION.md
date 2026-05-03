# LokBx Cloud - Shopify Integration Guide

## Overview

LnkLokr uses **LokBx** as its cloud service branding and integrates with your Shopify store for premium subscriptions.

## Payment Flow

### Purchase URL
The purchase URL is now driven by the `VITE_PURCHASE_URL` environment
variable on the Vercel deployment. It defaults to the in-app
`/api/stripe/create-checkout-session` route, which creates a Stripe
Checkout Session using `STRIPE_SECRET_KEY` and `STRIPE_PRICE_ID`. You
can override it with a hosted Stripe Payment Link or any other URL.

### How It Works

1. **Free Tier (Default)**
   - Local-first storage in browser IndexedDB
   - Unlimited links and folders (browser storage limit)
   - Manual JSON export/import for backups
   - No account required

2. **Premium Tier - LokBx Cloud ($4.99/month)**
   - Purchased through your Shopify store
   - Customer receives an activation key after purchase
   - Activation key unlocks:
     - LokBx cloud sync toggle
     - Automatic cloud backup
     - Multi-device synchronization
     - Premium badge in UI

## Activation Flow

1. User clicks "Get LokBx Premium" button
2. Redirects to Shopify product page
3. User completes purchase on Shopify
4. Shopify sends activation key to user (via email/order confirmation)
5. User returns to app and enters activation key in Settings
6. App validates and activates premium features
7. User can toggle LokBx cloud sync on/off

## Implementation Details

### Activation Key System

Located in: `src/lib/premiumService.ts`

```typescript
async activatePremium(activationKey: string): Promise<boolean> {
  const isValid = await this.validateKey(activationKey);

  if (isValid) {
    this.status = {
      isPremium: true,
      activationKey,
      activatedAt: new Date().toISOString(),
      cloudSyncEnabled: false,
    };

    await localStore.setSetting('premium_status', this.status);
    return true;
  }

  return false;
}
```

### Key Validation

Currently uses basic validation (length check). You should implement:
- API call to your backend to verify key against Shopify orders
- Check key hasn't been used on another device (if single-device license)
- Verify subscription is active
- Handle key revocation/expiration

### Recommended Backend Setup

1. **Shopify Webhook** - Listen for order creation
   ```
   POST /webhooks/shopify/orders/create
   ```

2. **Generate Activation Keys** - When premium variant is purchased
   ```typescript
   // Example key format: LOKBX-XXXX-XXXX-XXXX-XXXX
   const activationKey = generateUniqueKey();
   ```

3. **Validation Endpoint** - Verify activation keys
   ```
   POST /api/validate-key
   {
     "key": "LOKBX-XXXX-XXXX-XXXX-XXXX"
   }
   ```

4. **Store Mapping** - Database table
   ```sql
   CREATE TABLE activation_keys (
     id UUID PRIMARY KEY,
     key TEXT UNIQUE NOT NULL,
     shopify_order_id TEXT NOT NULL,
     customer_email TEXT NOT NULL,
     activated BOOLEAN DEFAULT FALSE,
     activated_at TIMESTAMP,
     created_at TIMESTAMP DEFAULT NOW()
   );
   ```

## Shopify Configuration

### Product Setup

1. Create product: "LnkLokr Premium - LokBx Cloud"
2. Set price: $4.99/month (subscription)
3. Use variant ID: `45668947230881`
4. Add to product description:
   - Automatic LokBx cloud backup
   - Sync across all devices
   - Never lose your data
   - Premium support

### Order Confirmation Email

Add activation key to order confirmation:
```
Thank you for purchasing LnkLokr Premium!

Your LokBx Cloud Activation Key:
LOKBX-XXXX-XXXX-XXXX-XXXX

To activate:
1. Open LnkLokr extension
2. Click Settings
3. Enter your activation key
4. Enable LokBx Sync to start backing up

Questions? Contact support@fineshoppes.com
```

## Cloud Sync Architecture (When Enabled)

When user enables LokBx sync:

1. **Initial Sync**
   - Upload all local data to Supabase
   - Store in user-specific tables

2. **Ongoing Sync**
   - Auto-save to both local IndexedDB and Supabase
   - Real-time updates via Supabase subscriptions
   - Conflict resolution (last-write-wins)

3. **Multi-Device**
   - Same activation key can be used on multiple devices
   - Data syncs in real-time across all devices
   - Local cache for offline access

## Testing

### Test Activation Key
For development, any key with length >= 10 will work.

Production should validate against your backend:
```typescript
private async validateKey(key: string): Promise<boolean> {
  // Call your validation API
  const response = await fetch('YOUR_API_URL/validate-key', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key })
  });

  const data = await response.json();
  return data.valid && !data.activated;
}
```

## Brand Consistency

All references to cloud service use **"LokBx"**:
- "Upgrade to LokBx Cloud"
- "LokBx Premium Active"
- "LokBx Sync"
- "Automatic LokBx cloud backup"
- Purchase button: "Get LokBx Premium"

## Next Steps

1. Set up Shopify webhook listener
2. Implement activation key generation
3. Create validation API endpoint
4. Update premiumService.validateKey() to call your API
5. Set up Supabase sync when cloudSyncEnabled = true
6. Configure email templates with activation keys
7. Add analytics to track conversions

## Support

For customers who need help:
- Lost activation key → Check order confirmation email
- Key not working → Verify it hasn't been used on another device
- Subscription issues → Contact Shopify store support
