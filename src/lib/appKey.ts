/**
 * The app identifier used across billing, subscriptions, and analytics.
 * Reads VITE_APP_KEY from the environment; falls back to 'lnklokr'.
 */
export const APP_KEY: string =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_APP_KEY) ||
  'lnklokr'
