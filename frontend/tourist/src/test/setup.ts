// src/test/setup.ts
// Every API-layer test transitively imports src/api/client.ts, which imports
// the Zustand auth store — persisted to IndexedDB (see auth.store.ts) since
// the app needs login to survive a full PWA close/reopen. Zustand's persist
// middleware calls storage.getItem() at module load to rehydrate, which
// opens a real IndexedDB connection; jsdom (vitest's test environment)
// doesn't provide one, so without this polyfill any test file that merely
// imports the API client fails with an unhandled DatabaseClosedError,
// regardless of what the test itself actually asserts.
import 'fake-indexeddb/auto'
