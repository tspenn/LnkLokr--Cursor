/**
 * dataService — routes all data operations to Supabase for every tier.
 *
 * Free tier  → Supabase (link metadata only; binary uploads blocked by RLS)
 * Paid tier  → Supabase (link metadata + binary file uploads)
 *
 * The isPremium parameter is retained on each function so callers do not need
 * to change. It is used only where behaviour genuinely differs by tier (e.g.
 * migrateLocalToCloud, which is a one-time upgrade path for legacy local data).
 */

import { localStore } from './localStore'
import { supabase } from './supabase'
import type { Link, Folder } from '@/types'

// ─── Links ────────────────────────────────────────────────────────────────────

export async function getLinks(_isPremium: boolean, userId: string): Promise<Link[]> {
  const { data, error } = await supabase
    .from('links')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function getLinksByStatus(
  _isPremium: boolean,
  userId: string,
  status: 'keep' | 'borrow' | 'share' | 'bury',
): Promise<Link[]> {
  const { data, error } = await supabase
    .from('links')
    .select('*')
    .eq('user_id', userId)
    .eq('status', status)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function addLink(
  _isPremium: boolean,
  userId: string,
  linkData: Partial<Link>,
): Promise<void> {
  const { error } = await supabase.from('links').insert({ ...linkData, user_id: userId })
  if (error) throw error
}

export async function updateLink(
  _isPremium: boolean,
  userId: string,
  id: string,
  updates: Partial<Link>,
): Promise<void> {
  const { error } = await supabase
    .from('links')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', userId)
  if (error) throw error
}

export async function deleteLink(
  _isPremium: boolean,
  userId: string,
  id: string,
): Promise<void> {
  const { error } = await supabase.from('links').delete().eq('id', id).eq('user_id', userId)
  if (error) throw error
}

// ─── Folders ──────────────────────────────────────────────────────────────────

export async function getFolders(_isPremium: boolean, userId: string): Promise<Folder[]> {
  const { data, error } = await supabase
    .from('folders')
    .select('*')
    .eq('user_id', userId)
    .order('position')
  if (error) throw error
  return data ?? []
}

export async function addFolder(
  _isPremium: boolean,
  userId: string,
  folderData: Partial<Folder>,
): Promise<void> {
  const { error } = await supabase.from('folders').insert({ ...folderData, user_id: userId })
  if (error) throw error
}

export async function deleteFolder(
  _isPremium: boolean,
  userId: string,
  id: string,
): Promise<void> {
  const { error } = await supabase.from('folders').delete().eq('id', id).eq('user_id', userId)
  if (error) throw error
}

// ─── Upgrade migration ────────────────────────────────────────────────────────

export interface MigrationResult {
  links: number
  folders: number
  skipped: number
}

/**
 * One-time migration: copies any legacy IndexedDB data to Supabase cloud.
 * Called when a user who saved data locally before this change wants to
 * transfer it. Leaves local data intact so the user can verify before clearing.
 */
export async function migrateLocalToCloud(userId: string): Promise<MigrationResult> {
  await localStore.init()
  const { links, folders } = await localStore.exportData()

  let migratedLinks = 0
  let migratedFolders = 0
  let skipped = 0

  if (folders.length > 0) {
    const cloudFolders = folders.map(f => ({ ...f, user_id: userId }))
    const { error } = await supabase.from('folders').insert(cloudFolders)
    if (error) {
      console.error('Folder migration error:', error.message)
      skipped += folders.length
    } else {
      migratedFolders = folders.length
    }
  }

  if (links.length > 0) {
    const BATCH = 50
    for (let i = 0; i < links.length; i += BATCH) {
      const batch = links.slice(i, i + BATCH).map(l => ({ ...l, user_id: userId }))
      const { error } = await supabase.from('links').insert(batch)
      if (error) {
        console.error('Link migration batch error:', error.message)
        skipped += batch.length
      } else {
        migratedLinks += batch.length
      }
    }
  }

  return { links: migratedLinks, folders: migratedFolders, skipped }
}

/**
 * Clear local IndexedDB after a successful migration.
 * Only call this after the user has confirmed the migration succeeded.
 */
export async function clearLocalAfterMigration(): Promise<void> {
  await localStore.init()
  await localStore.clearAll()
}
