// Saves the current project in this browser (IndexedDB), so a page reload doesn't lose the work.
// Nothing leaves the computer. IndexedDB is used instead of localStorage because images can be bigger than
// localStorage's ~5 MB limit. Every call fails silently (private windows, blocked storage): the app works without it.

const DB_NAME = 'ts6-channel-image-generator';
const STORE = 'project';

const openDb = () => new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
});

const run = async (mode, action) => {
    const db = await openDb();
    try {
        return await new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE, mode);
            const request = action(transaction.objectStore(STORE));
            transaction.oncomplete = () => resolve(request.result);
            transaction.onerror = () => reject(transaction.error);
        });
    } finally {
        db.close();
    }
};

export const loadItem = (key) => run('readonly', (store) => store.get(key)).catch(() => undefined);
export const saveItem = (key, value) => run('readwrite', (store) => store.put(value, key)).catch(() => undefined);
export const clearItems = () => run('readwrite', (store) => store.clear()).catch(() => undefined);
