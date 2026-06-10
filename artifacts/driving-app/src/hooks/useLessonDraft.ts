/**
 * useLessonDraft — IndexedDB-backed write-ahead log for active guided lessons.
 *
 * Persists GPS route points and all lesson state to IndexedDB on every tick
 * and on every maneuver interaction. On app mount the caller should check
 * loadDraft() and offer to restore. On successful server commit, call clearDraft().
 *
 * Uses the native IDBDatabase API directly — no external dependency.
 */

const DB_NAME = "drivetrack_lessons";
const STORE_NAME = "drafts";
const DRAFT_KEY = "active";

export type LessonDraftState = {
  studentId: string;
  duration: string;
  date: string;
  pedalOperator: string;
  results: Record<number, string>;
  maneuverNotes: Record<number, string>;
  maneuverLocations: Record<number, { lat: number; lng: number }>;
  routePoints: Array<{ lat: number; lng: number; ts: number }>;
  selectedManeuverIds: number[];
  confidenceNote: string;
  focusAreas: string;
  savedAt: number;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = (e) => resolve((e.target as IDBOpenDBRequest).result);
    req.onerror = () => reject(req.error);
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, mode);
    const store = tx.objectStore(STORE_NAME);
    const req = fn(store);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}

export function useLessonDraft() {
  /**
   * Persist the current lesson state. Call this:
   *  - Inside the GPS sampling interval
   *  - After every maneuver level selection
   */
  async function saveDraft(draft: LessonDraftState): Promise<void> {
    try {
      await withStore("readwrite", (store) =>
        store.put({ ...draft, savedAt: Date.now() }, DRAFT_KEY),
      );
    } catch {
      // Non-fatal — draft persistence is best-effort
    }
  }

  /**
   * Load a previously saved draft, if one exists.
   * Returns null if no draft is found or if IndexedDB is unavailable.
   */
  async function loadDraft(): Promise<LessonDraftState | null> {
    try {
      const result = await withStore<LessonDraftState | undefined>(
        "readonly",
        (store) => store.get(DRAFT_KEY),
      );
      return result ?? null;
    } catch {
      return null;
    }
  }

  /**
   * Remove the draft after a successful server commit.
   */
  async function clearDraft(): Promise<void> {
    try {
      await withStore("readwrite", (store) => store.delete(DRAFT_KEY));
    } catch {
      // Non-fatal
    }
  }

  return { saveDraft, loadDraft, clearDraft };
}
