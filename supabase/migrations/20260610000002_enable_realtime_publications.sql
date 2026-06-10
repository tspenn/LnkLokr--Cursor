-- Migration: Enable Realtime on core LnkLokr tables
-- Adds links, saved_items, and folders to the supabase_realtime publication
-- so that postgres_changes subscriptions work on a fresh project deployment.

ALTER PUBLICATION supabase_realtime ADD TABLE links;
ALTER PUBLICATION supabase_realtime ADD TABLE saved_items;
ALTER PUBLICATION supabase_realtime ADD TABLE folders;
