-- Listing fields scraped from product pages (price, colors, options).
-- CSV export uses these plus the image URL, not the image file.

ALTER TABLE public.links
  ADD COLUMN IF NOT EXISTS listing_price text,
  ADD COLUMN IF NOT EXISTS listing_currency text,
  ADD COLUMN IF NOT EXISTS listing_colors text,
  ADD COLUMN IF NOT EXISTS listing_options text;
