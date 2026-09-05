/**
 * dataService — routes data by session.
 *
 * Guest (no userId) → IndexedDB on this device (try-before-signup)
 * Signed-in free    → Supabase (link metadata only; binary uploads blocked by RLS)
 * Signed-in paid    → Supabase (link metadata + binary file uploads)
 */

import { localStore } from './localStore'
import { supabase } from './supabase'
import type { Link, Folder } from '@/types'

function isGuest(userId: string) {
  return !userId
}

async function localReady() {
  await localStore.init()
}

// ─── Links ────────────────────────────────────────────────────────────────────

export async function getLinks(_isPremium: boolean, userId: string): Promise<Link[]> {
  if (isGuest(userId)) {
    await localReady()
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
  _isPremium: boolean,
  userId: string,
  status: 'keep' | 'borrow' | 'share' | 'bury',
): Promise<Link[]> {
  if (isGuest(userId)) {
    await localReady()
    const all = await localStore.getLinks()
    return all.filter(l => (l.status || 'keep') === status)
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
  _isPremium: boolean,
  userId: string,
  linkData: Partial<Link>,
): Promise<void> {
  if (isGuest(userId)) {
    await localReady()
    await localStore.addLink({
      url: linkData.url ?? '',
      title: linkData.title ?? 'Untitled',
      ...linkData,
    } as Omit<Link, 'id' | 'created_at'>)
    return
  }
  const { error } = await supabase.from('links').insert({ ...linkData, user_id: userId })
  if (error) throw error
}

export async function updateLink(
  _isPremium: boolean,
  userId: string,
  id: string,
  updates: Partial<Link>,
): Promise<void> {
  if (isGuest(userId)) {
    await localReady()
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
  _isPremium: boolean,
  userId: string,
  id: string,
): Promise<void> {
  if (isGuest(userId)) {
    await localReady()
    await localStore.deleteLink(id)
    return
  }
  const { error } = await supabase.from('links').delete().eq('id', id).eq('user_id', userId)
  if (error) throw error
}

// ─── Folders ──────────────────────────────────────────────────────────────────

export async function getFolders(_isPremium: boolean, userId: string): Promise<Folder[]> {
  if (isGuest(userId)) {
    await localReady()
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
  _isPremium: boolean,
  userId: string,
  folderData: Partial<Folder>,
): Promise<void> {
  if (isGuest(userId)) {
    await localReady()
    await localStore.addFolder({
      name: folderData.name ?? 'Folder',
      ...folderData,
    } as Omit<Folder, 'id' | 'created_at'>)
    return
  }
  const { error } = await supabase.from('folders').insert({ ...folderData, user_id: userId })
  if (error) throw error
}

export async function deleteFolder(
  _isPremium: boolean,
  userId: string,
  id: string,
): Promise<void> {
  if (isGuest(userId)) {
    await localReady()
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
