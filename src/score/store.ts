// Caches the user-loaded score file in IndexedDB so it only has to be picked once per browser.
// Every call degrades to "not cached" if IndexedDB is unavailable (private mode, blocked storage).

const DB = 'swan-accompaniment';
const STORE = 'files';
const KEY = 'score';

export interface StoredFile {
  name: string;
  bytes: ArrayBuffer;
}

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run<T>(mode: IDBTransactionMode, op: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  const db = await open();
  try {
    return await new Promise<T>((resolve, reject) => {
      const req = op(db.transaction(STORE, mode).objectStore(STORE));
      req.onsuccess = () => resolve(req.result as T);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

export async function saveScoreFile(file: StoredFile): Promise<boolean> {
  try {
    await run('readwrite', (s) => s.put(file, KEY));
    return true;
  } catch {
    return false;
  }
}

export async function loadScoreFile(): Promise<StoredFile | null> {
  try {
    return (await run<StoredFile | undefined>('readonly', (s) => s.get(KEY))) ?? null;
  } catch {
    return null;
  }
}

export async function clearScoreFile(): Promise<void> {
  try {
    await run('readwrite', (s) => s.delete(KEY));
  } catch {
    // Nothing cached to clear.
  }
}
