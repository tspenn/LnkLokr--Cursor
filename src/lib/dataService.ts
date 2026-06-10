/**
 * dataService — routes data operations to the correct store based on tier.
 *
 * Free tier  → IndexedDB via localStore (local-only, private, one device)
 * Paid tier  → Supabase (cloud-synced, multi-device)
 *
 * Free users never write to Supabase. Supabase RLS remains as a safety net.
 */

import { localStore } from './localStore'
import { supabase } from './supabase'
import type { Link, Folder } from '@/types'

// ─── internal init guard ──────────────────────────────────────────────────────

let localStoreReady = false
async function ensureLocal(): Promise<void> {
  if (!localStoreReady) {
    await localStore.init()
    localStoreReady = true
  }
}

// ─── Links ────────────────────────────────────────────────────────────────────

export async function getLinks(isPremium: boolean, userId: string): Promise<Link[]> {
  if (!isPremium) {
    await ensureLocal()
    return localStore.getLinks()
  }
  const { data, error } = await supabase
    .from('links')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function getLinksByStatus(
  isPremium: boolean,
  userId: string,
  status: 'keep' | 'borrow' | 'share' | 'bury',
): Promise<Link[]> {
  if (!isPremium) {
    await ensureLocal()
    const all = await localStore.getLinks()
    return all.filter(l => (l.status ?? 'keep') === status)
  }
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
  isPremium: boolean,
  userId: string,
  linkData: Partial<Link>,
): Promise<void> {
  if (!isPremium) {
    await ensureLocal()
    await localStore.addLink({
      url: linkData.url ?? '',
      title: linkData.title ?? '',
      description: linkData.description ?? null,
      thumbnail_url: linkData.thumbnail_url ?? null,
      icon: linkData.icon ?? null,
      status: linkData.status ?? 'keep',
      folder_id: linkData.folder_id ?? null,
      tags: linkData.tags ?? [],
      is_favorite: linkData.is_favorite ?? false,
      content_type: linkData.content_type ?? 'url',
      notes: linkData.notes ?? null,
    })
    return
  }
  const { error } = await supabase.from('links').insert({ ...linkData, user_id: userId })
  if (error) throw error
}

export async function updateLink(
  isPremium: boolean,
  userId: string,
  id: string,
  updates: Partial<Link>,
): Promise<void> {
  if (!isPremium) {
    await ensureLocal()
    await localStore.updateLink(id, updates)
    return
  }
  const { error } = await supabase
    .from('links')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', userId)
  if (error) throw error
}

export async function deleteLink(
  isPremium: boolean,
  userId: string,
  id: string,
): Promise<void> {
  if (!isPremium) {
    await ensureLocal()
    await localStore.deleteLink(id)
    return
  }
  const { error } = await supabase.from('links').delete().eq('id', id).eq('user_id', userId)
  if (error) throw error
}

// ─── Folders ──────────────────────────────────────────────────────────────────

export async function getFolders(isPremium: boolean, userId: string): Promise<Folder[]> {
  if (!isPremium) {
    await ensureLocal()
    return localStore.getFolders()
  }
  const { data, error } = await supabase
    .from('folders')
    .select('*')
    .eq('user_id', userId)
    .order('position')
  if (error) throw error
  return data ?? []
}

export async function addFolder(
  isPremium: boolean,
  userId: string,
  folderData: Partial<Folder>,
): Promise<void> {
  if (!isPremium) {
    await ensureLocal()
    await localStore.addFolder({
      user_id: userId,
      name: folderData.name ?? 'New Folder',
      description: folderData.description,
      color: folderData.color,
      icon: folderData.icon,
      position: folderData.position,
    })
    return
  }
  const { error } = await supabase.from('folders').insert({ ...folderData, user_id: userId })
  if (error) throw error
}

export async function deleteFolder(
  isPremium: boolean,
  userId: string,
  id: string,
): Promise<void> {
  if (!isPremium) {
    await ensureLocal()
    await localStore.deleteFolder(id)
    return
  }
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
 * One-time migration: copies all IndexedDB data to Supabase cloud.
 * Called when a free user upgrades to a paid tier and chooses to transfer.
 * Leaves local data intact so the user can verify before clearing.
 */
export async function migrateLocalToCloud(userId: string): Promise<MigrationResult> {
  await ensureLocal()
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
    // Insert in batches of 50 to avoid request size limits
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
  await ensureLocal()
  await localStore.clearAll()
}
