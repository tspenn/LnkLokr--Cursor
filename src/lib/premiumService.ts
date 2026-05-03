import { localStore } from './localStore';

export interface PremiumStatus {
  isPremium: boolean;
  activationKey?: string;
  activatedAt?: string;
  cloudSyncEnabled: boolean;
}

/**
 * Pricing tiers as shown on the LnkLokr product page. Each tier maps to a
 * Stripe Price ID configured in your Vercel project env vars.
 *
 * The `mode` is what Stripe uses for Checkout Session creation:
 *   - "payment"      → one-time charge (One Device, 5-device add-on)
 *   - "subscription" → recurring (LokBx Cloud monthly / yearly)
 */
export type TierId =
  | 'one-device'
  | 'five-device'
  | 'cloud-monthly'
  | 'cloud-yearly';

export interface Tier {
  id: TierId;
  name: string;
  priceLabel: string;
  description: string;
  mode: 'payment' | 'subscription';
  /** Env-var key on the server (Vercel) holding the Stripe Price ID. */
  priceEnvVar: string;
}

export const TIERS: Record<TierId, Tier> = {
  'one-device': {
    id: 'one-device',
    name: 'LnkLokr — One Device',
    priceLabel: '$3.99',
    description: 'Stand-alone install for a single PC or mobile device.',
    mode: 'payment',
    priceEnvVar: 'STRIPE_PRICE_ID_ONE_DEVICE',
  },
  'five-device': {
    id: 'five-device',
    name: 'More Devices — 5 Device Pack',
    priceLabel: '$7.99',
    description: 'Add-on. Activate LnkLokr on up to 5 total devices.',
    mode: 'payment',
    priceEnvVar: 'STRIPE_PRICE_ID_FIVE_DEVICE',
  },
  'cloud-monthly': {
    id: 'cloud-monthly',
    name: 'LokBx Cloud Storage — Monthly',
    priceLabel: '$4.99 / month',
    description: 'Sync, backup, and restore across all your devices.',
    mode: 'subscription',
    priceEnvVar: 'STRIPE_PRICE_ID_CLOUD_MONTHLY',
  },
  'cloud-yearly': {
    id: 'cloud-yearly',
    name: 'LokBx Cloud Storage — Yearly',
    priceLabel: '$59.00 / year',
    description: 'Two months free vs. paying monthly.',
    mode: 'subscription',
    priceEnvVar: 'STRIPE_PRICE_ID_CLOUD_YEARLY',
  },
};

export const TIER_ORDER: TierId[] = [
  'one-device',
  'five-device',
  'cloud-monthly',
  'cloud-yearly',
];

class PremiumService {
  private status: PremiumStatus | null = null;

  async init(): Promise<void> {
    const saved = await localStore.getSetting('premium_status');
    this.status = saved || {
      isPremium: false,
      cloudSyncEnabled: false,
    };
  }

  async getStatus(): Promise<PremiumStatus> {
    if (!this.status) {
      await this.init();
    }
    return this.status!;
  }

  /**
   * Starts a Stripe checkout session via the serverless API route. The route
   * resolves `tier` to the right Stripe Price ID using the *_ENV_VAR mapping
   * in TIERS. Pass an email to prefill the Checkout customer field.
   */
  async startCheckout(tier: TierId, email?: string): Promise<string | null> {
    try {
      const res = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier, email }),
      });

      if (!res.ok) {
        const detail = await res.text().catch(() => '');
        throw new Error(`Checkout session failed: ${res.status} ${detail}`);
      }

      const { url } = (await res.json()) as { url?: string };
      return url ?? null;
    } catch (error) {
      console.error('Failed to start Stripe checkout:', error);
      return null;
    }
  }

  /** Convenience helpers for the most common upgrade paths. */
  startCloudCheckout(billing: 'monthly' | 'yearly', email?: string) {
    return this.startCheckout(billing === 'yearly' ? 'cloud-yearly' : 'cloud-monthly', email);
  }

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

  private async validateKey(key: string): Promise<boolean> {
    return key.length >= 10;
  }

  async toggleCloudSync(enabled: boolean): Promise<boolean> {
    if (!this.status) await this.init();

    if (!this.status!.isPremium) {
      return false;
    }

    this.status!.cloudSyncEnabled = enabled;
    await localStore.setSetting('premium_status', this.status);
    return true;
  }

  async deactivate(): Promise<void> {
    this.status = {
      isPremium: false,
      cloudSyncEnabled: false,
    };
    await localStore.setSetting('premium_status', this.status);
  }

  isPremiumUser(): boolean {
    return this.status?.isPremium || false;
  }

  isCloudSyncEnabled(): boolean {
    return (this.status?.isPremium && this.status?.cloudSyncEnabled) || false;
  }
}

export const premiumService = new PremiumService();

/**
 * Where the "Upgrade" buttons in the marketing UI send the user. Defaults
 * to kicking off a LokBx Cloud monthly subscription via the in-app API.
 * Override with `VITE_PURCHASE_URL` to point at a hosted Stripe Payment
 * Link or a Shopify product page.
 */
export const PURCHASE_URL: string =
  (import.meta.env.VITE_PURCHASE_URL as string | undefined) ||
  '/api/stripe/create-checkout-session?tier=cloud-monthly';
