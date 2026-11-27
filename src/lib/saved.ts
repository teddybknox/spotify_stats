/**
 * Keeps uploaded exports in this browser (IndexedDB) so they can be reopened
 * from the landing page without choosing the file again. Nothing leaves the browser.
 */

export interface SavedMeta {
  id: string;
  /** File name(s) as uploaded, e.g. "my_spotify_data.zip". */
  name: string;
  savedAt: number;
  bytes: number;
  plays: number;
  /** First and last day with a play, YYYY-MM-DD. */
  from: string;
  to: string;
}

interface SavedRecord extends SavedMeta {
  files: File[];
}

const DB = 'spotify-stats';
const STORE = 'uploads';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('No IndexedDB'));
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const req = fn(tx.objectStore(STORE));
        tx.oncomplete = () => {
          db.close();
          resolve(req.result);
        };
        tx.onerror = tx.onabort = () => {
          db.close();
          reject(tx.error ?? req.error);
        };
      }),
  );
}

/** Same files (by name and size) map to the same id, so re-uploading replaces rather than duplicates. */
export function uploadId(files: { name: string; size: number }[]): string {
  return files
    .map((f) => `${f.name}:${f.size}`)
    .sort()
    .join('|');
}

export async function listSaved(): Promise<SavedMeta[]> {
  try {
    const all = await run<SavedRecord[]>('readonly', (s) => s.getAll() as IDBRequest<SavedRecord[]>);
    return all
      .map(({ files: _files, ...meta }) => meta)
      .sort((a, b) => b.savedAt - a.savedAt);
  } catch {
    return [];
  }
}

export async function saveUpload(files: File[], summary: Pick<SavedMeta, 'plays' | 'from' | 'to'>): Promise<void> {
  const record: SavedRecord = {
    id: uploadId(files),
    name: files.length === 1 ? files[0].name : `${files.length} files`,
    savedAt: Date.now(),
    bytes: files.reduce((n, f) => n + f.size, 0),
    ...summary,
    files,
  };
  try {
    await run('readwrite', (s) => s.put(record));
  } catch {
    // Storage full, private window or blocked: the dashboard still works, it just isn't saved.
  }
}

export async function loadSaved(id: string): Promise<File[] | null> {
  try {
    const r = await run<SavedRecord | undefined>('readonly', (s) => s.get(id) as IDBRequest<SavedRecord | undefined>);
    return r?.files ?? null;
  } catch {
    return null;
  }
}

export async function deleteSaved(id: string): Promise<void> {
  try {
    await run('readwrite', (s) => s.delete(id));
  } catch {
    /* ignore */
  }
}
