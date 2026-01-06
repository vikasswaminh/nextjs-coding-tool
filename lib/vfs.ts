import { openDB, DBSchema, IDBPDatabase } from 'idb';

interface VFSSchema extends DBSchema {
  files: {
    key: string;
    value: {
      path: string;
      content: string;
      updatedAt: number;
    };
  };
}

const DB_NAME = 'coding-tool-vfs';
const DB_VERSION = 1;
const STORE_NAME = 'files';

let dbPromise: Promise<IDBPDatabase<VFSSchema>> | null = null;

async function getDB(): Promise<IDBPDatabase<VFSSchema>> {
  if (!dbPromise) {
    dbPromise = openDB<VFSSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'path' });
        }
      },
    });
  }
  return dbPromise;
}

export interface VFile {
  path: string;
  content: string;
  updatedAt: number;
}

export async function listFiles(): Promise<VFile[]> {
  const db = await getDB();
  return db.getAll(STORE_NAME);
}

export async function getFile(path: string): Promise<VFile | undefined> {
  const db = await getDB();
  return db.get(STORE_NAME, path);
}

export async function writeFile(path: string, content: string): Promise<void> {
  const db = await getDB();
  await db.put(STORE_NAME, {
    path,
    content,
    updatedAt: Date.now(),
  });
}

export async function deleteFile(path: string): Promise<void> {
  const db = await getDB();
  await db.delete(STORE_NAME, path);
}
