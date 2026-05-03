import { Link, Folder, SavedImage } from '../types';

const DB_NAME = 'lnklokr';
const DB_VERSION = 1;

interface LocalStorageStats {
  total_links: number;
  total_folders: number;
  total_images: number;
  storage_used_mb: number;
}

class LocalStore {
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        if (!db.objectStoreNames.contains('links')) {
          const linkStore = db.createObjectStore('links', { keyPath: 'id' });
          linkStore.createIndex('folder_id', 'folder_id', { unique: false });
          linkStore.createIndex('created_at', 'created_at', { unique: false });
        }

        if (!db.objectStoreNames.contains('folders')) {
          const folderStore = db.createObjectStore('folders', { keyPath: 'id' });
          folderStore.createIndex('created_at', 'created_at', { unique: false });
        }

        if (!db.objectStoreNames.contains('images')) {
          const imageStore = db.createObjectStore('images', { keyPath: 'id' });
          imageStore.createIndex('created_at', 'created_at', { unique: false });
        }

        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }
      };
    });
  }

  private getStore(storeName: string, mode: IDBTransactionMode = 'readonly'): IDBObjectStore {
    if (!this.db) throw new Error('Database not initialized');
    const transaction = this.db.transaction(storeName, mode);
    return transaction.objectStore(storeName);
  }

  async addLink(link: Omit<Link, 'id' | 'created_at'>): Promise<Link> {
    const newLink: Link = {
      ...link,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
    };

    return new Promise((resolve, reject) => {
      const store = this.getStore('links', 'readwrite');
      const request = store.add(newLink);
      request.onsuccess = () => resolve(newLink);
      request.onerror = () => reject(request.error);
    });
  }

  async getLinks(folderId?: string): Promise<Link[]> {
    return new Promise((resolve, reject) => {
      const store = this.getStore('links');
      const request = folderId
        ? store.index('folder_id').getAll(folderId)
        : store.getAll();

      request.onsuccess = () => {
        const links = request.result as Link[];
        links.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        resolve(links);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async updateLink(id: string, updates: Partial<Link>): Promise<void> {
    return new Promise((resolve, reject) => {
      const store = this.getStore('links', 'readwrite');
      const getRequest = store.get(id);

      getRequest.onsuccess = () => {
        const link = getRequest.result;
        if (!link) {
          reject(new Error('Link not found'));
          return;
        }

        const updatedLink = { ...link, ...updates };
        const putRequest = store.put(updatedLink);
        putRequest.onsuccess = () => resolve();
        putRequest.onerror = () => reject(putRequest.error);
      };
      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  async deleteLink(id: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const store = this.getStore('links', 'readwrite');
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async addFolder(folder: Omit<Folder, 'id' | 'created_at'>): Promise<Folder> {
    const newFolder: Folder = {
      ...folder,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
    };

    return new Promise((resolve, reject) => {
      const store = this.getStore('folders', 'readwrite');
      const request = store.add(newFolder);
      request.onsuccess = () => resolve(newFolder);
      request.onerror = () => reject(request.error);
    });
  }

  async getFolders(): Promise<Folder[]> {
    return new Promise((resolve, reject) => {
      const store = this.getStore('folders');
      const request = store.getAll();

      request.onsuccess = () => {
        const folders = request.result as Folder[];
        folders.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        resolve(folders);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async updateFolder(id: string, updates: Partial<Folder>): Promise<void> {
    return new Promise((resolve, reject) => {
      const store = this.getStore('folders', 'readwrite');
      const getRequest = store.get(id);

      getRequest.onsuccess = () => {
        const folder = getRequest.result;
        if (!folder) {
          reject(new Error('Folder not found'));
          return;
        }

        const updatedFolder = { ...folder, ...updates };
        const putRequest = store.put(updatedFolder);
        putRequest.onsuccess = () => resolve();
        putRequest.onerror = () => reject(putRequest.error);
      };
      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  async deleteFolder(id: string): Promise<void> {
    return new Promise(async (resolve, reject) => {
      try {
        const links = await this.getLinks(id);
        const transaction = this.db!.transaction(['folders', 'links'], 'readwrite');

        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);

        const folderStore = transaction.objectStore('folders');
        folderStore.delete(id);

        const linkStore = transaction.objectStore('links');
        for (const link of links) {
          linkStore.delete(link.id);
        }
      } catch (error) {
        reject(error);
      }
    });
  }

  async addImage(image: Omit<SavedImage, 'id' | 'created_at'>): Promise<SavedImage> {
    const newImage: SavedImage = {
      ...image,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
    };

    return new Promise((resolve, reject) => {
      const store = this.getStore('images', 'readwrite');
      const request = store.add(newImage);
      request.onsuccess = () => resolve(newImage);
      request.onerror = () => reject(request.error);
    });
  }

  async getImages(): Promise<SavedImage[]> {
    return new Promise((resolve, reject) => {
      const store = this.getStore('images');
      const request = store.getAll();

      request.onsuccess = () => {
        const images = request.result as SavedImage[];
        images.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        resolve(images);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async deleteImage(id: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const store = this.getStore('images', 'readwrite');
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getStats(): Promise<LocalStorageStats> {
    const [links, folders, images] = await Promise.all([
      this.getLinks(),
      this.getFolders(),
      this.getImages(),
    ]);

    const imageSize = images.reduce((total, img) => {
      return total + (img.data_url?.length || 0);
    }, 0);

    return {
      total_links: links.length,
      total_folders: folders.length,
      total_images: images.length,
      storage_used_mb: imageSize / (1024 * 1024),
    };
  }

  async getSetting(key: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const store = this.getStore('settings');
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result?.value);
      request.onerror = () => reject(request.error);
    });
  }

  async setSetting(key: string, value: any): Promise<void> {
    return new Promise((resolve, reject) => {
      const store = this.getStore('settings', 'readwrite');
      const request = store.put({ key, value });
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async exportData(): Promise<{ links: Link[]; folders: Folder[]; images: SavedImage[] }> {
    const [links, folders, images] = await Promise.all([
      this.getLinks(),
      this.getFolders(),
      this.getImages(),
    ]);

    return { links, folders, images };
  }

  async importData(data: { links?: Link[]; folders?: Folder[]; images?: SavedImage[] }): Promise<void> {
    const transaction = this.db!.transaction(['links', 'folders', 'images'], 'readwrite');

    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);

      if (data.folders) {
        const folderStore = transaction.objectStore('folders');
        data.folders.forEach(folder => folderStore.put(folder));
      }

      if (data.links) {
        const linkStore = transaction.objectStore('links');
        data.links.forEach(link => linkStore.put(link));
      }

      if (data.images) {
        const imageStore = transaction.objectStore('images');
        data.images.forEach(image => imageStore.put(image));
      }
    });
  }

  async clearAll(): Promise<void> {
    const transaction = this.db!.transaction(['links', 'folders', 'images'], 'readwrite');

    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);

      transaction.objectStore('links').clear();
      transaction.objectStore('folders').clear();
      transaction.objectStore('images').clear();
    });
  }
}

export const localStore = new LocalStore();
