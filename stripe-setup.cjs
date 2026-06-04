/**
 * stripe-setup.js
 *
 * One-time script to create LnkLokr products and prices in Stripe.
 *
 * Usage:
 *   node stripe-setup.js
 *
 * Requires STRIPE_SECRET_KEY in your environment.
 * Either set it in your .env file (loaded below) or export it first:
 *   $env:STRIPE_SECRET_KEY="sk_live_..."   (PowerShell)
 *   export STRIPE_SECRET_KEY="sk_live_..."  (bash)
 */

// Load .env manually — no dotenv dependency needed
const fs = require('fs')
const path = require('path')
const envPath = path.join(__dirname, '.env')
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8')
    .split('\n')
    .forEach(line => {
      const match = line.match(/^\s*([^#=\s][^=]*?)\s*=\s*(.*?)\s*$/)
      if (match && !process.env[match[1]]) {
        process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '')
      }
    })
}

const Stripe = require('stripe')

const secret = process.env.STRIPE_SECRET_KEY
if (!secret) {
  console.error('\n❌  STRIPE_SECRET_KEY is not set.')
  console.error('    Add it to your .env file or export it in your shell, then re-run.\n')
  process.exit(1)
}

if (secret.startsWith('sk_live_')) {
  console.log('⚠️   Using LIVE Stripe key — prices will be created in your live account.\n')
} else {
  console.log('🧪  Using TEST Stripe key — prices will be created in test mode.\n')
}

const stripe = new Stripe(secret, { apiVersion: '2024-06-20' })

async function run() {
  // ── Product 1: Solo ─────────────────────────────────────────────────────────
  console.log('Creating product: LnkLokr Solo…')
  const solo = await stripe.products.create({
    name: 'LnkLokr Solo',
    description: 'All your mobile devices · 2 GB cloud · No ads',
    metadata: {
      app_key: 'lnklokr',
      tier_key: 'solo',
    },
  })
  console.log(`  ✓ Product created  id=${solo.id}`)

  console.log('  Creating Solo Monthly price ($2.99/mo)…')
  const soloMonthly = await stripe.prices.create({
    product: solo.id,
    unit_amount: 299,
    currency: 'usd',
    recurring: { interval: 'month' },
    nickname: 'LnkLokr Solo — Monthly',
    metadata: {
      app_key: 'lnklokr',
      tier_key: 'solo',
      billing_cycle: 'monthly',
    },
  })
  console.log(`  ✓ Solo Monthly      id=${soloMonthly.id}`)

  console.log('  Creating Solo Yearly price ($24.99/yr)…')
  const soloYearly = await stripe.prices.create({
    product: solo.id,
    unit_amount: 2499,
    currency: 'usd',
    recurring: { interval: 'year' },
    nickname: 'LnkLokr Solo — Yearly',
    metadata: {
      app_key: 'lnklokr',
      tier_key: 'solo',
      billing_cycle: 'yearly',
    },
  })
  console.log(`  ✓ Solo Yearly       id=${soloYearly.id}`)

  // ── Product 2: Pro ──────────────────────────────────────────────────────────
  console.log('\nCreating product: LnkLokr Pro…')
  const pro = await stripe.products.create({
    name: 'LnkLokr Pro',
    description: 'All devices + PC/Mac/Chromebook · Chrome extension · 10 GB cloud · No ads',
    metadata: {
      app_key: 'lnklokr',
      tier_key: 'pro',
    },
  })
  console.log(`  ✓ Product created  id=${pro.id}`)

  console.log('  Creating Pro Monthly price ($5.99/mo)…')
  const proMonthly = await stripe.prices.create({
    product: pro.id,
    unit_amount: 599,
    currency: 'usd',
    recurring: { interval: 'month' },
    nickname: 'LnkLokr Pro — Monthly',
    metadata: {
      app_key: 'lnklokr',
      tier_key: 'pro',
      billing_cycle: 'monthly',
    },
  })
  console.log(`  ✓ Pro Monthly       id=${proMonthly.id}`)

  console.log('  Creating Pro Yearly price ($49.99/yr)…')
  const proYearly = await stripe.prices.create({
    product: pro.id,
    unit_amount: 4999,
    currency: 'usd',
    recurring: { interval: 'year' },
    nickname: 'LnkLokr Pro — Yearly',
    metadata: {
      app_key: 'lnklokr',
      tier_key: 'pro',
      billing_cycle: 'yearly',
    },
  })
  console.log(`  ✓ Pro Yearly        id=${proYearly.id}`)

  // ── Summary ─────────────────────────────────────────────────────────────────
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('  ✅  All done! Copy these into Vercel → Settings → Environment Variables:')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
  console.log(`  STRIPE_PRICE_ID_SOLO_MONTHLY=${soloMonthly.id}`)
  console.log(`  STRIPE_PRICE_ID_SOLO_YEARLY=${soloYearly.id}`)
  console.log(`  STRIPE_PRICE_ID_PRO_MONTHLY=${proMonthly.id}`)
  console.log(`  STRIPE_PRICE_ID_PRO_YEARLY=${proYearly.id}`)
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('  Also update these in your local .env file for testing.')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
}

run().catch(err => {
  console.error('\n❌  Script failed:', err.message)
  process.exit(1)
})
