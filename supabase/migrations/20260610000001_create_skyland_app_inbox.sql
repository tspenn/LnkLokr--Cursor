-- Migration: Create skyland_app_inbox table with RLS
-- Supports cross-app inbox for the Skyland Reach app ecosystem.
-- Other apps (FRIDAY Canvas, Go Shop, TRVL, MY$) insert rows via the service role;
-- authenticated users can read and mark their own messages as read.

CREATE TABLE IF NOT EXISTS public.skyland_app_inbox (
  id              uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  source_app      text        NOT NULL,
  destination_app text        NOT NULL,
  user_id         uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content         text        NOT NULL,
  item_type       text        NOT NULL DEFAULT 'note',
  metadata        jsonb,
  is_read         boolean     NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.skyland_app_inbox ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read their own messages, or any message addressed to 'lnklokr'
CREATE POLICY "inbox_select" ON public.skyland_app_inbox
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR destination_app = 'lnklokr');

-- Authenticated users can update (mark as read) only their own messages
CREATE POLICY "inbox_update" ON public.skyland_app_inbox
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Only the service role may insert rows (external apps send messages, not users)
CREATE POLICY "inbox_insert_service" ON public.skyland_app_inbox
  FOR INSERT TO service_role
  WITH CHECK (true);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_skyland_app_inbox_user_id         ON public.skyland_app_inbox (user_id);
CREATE INDEX IF NOT EXISTS idx_skyland_app_inbox_destination_app ON public.skyland_app_inbox (destination_app);
CREATE INDEX IF NOT EXISTS idx_skyland_app_inbox_is_read         ON public.skyland_app_inbox (is_read);
