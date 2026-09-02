import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';

// Node 26 ships a native `localStorage` global that is inert unless the
// process is started with --localstorage-file, and it ends up shadowing the
// working implementation jsdom would otherwise provide (note that
// sessionStorage, which Node has no native version of, survives fine).
// App code uses the bare global — MoveContext's active-move id and the
// sidebar's collapsed flag — so tests install a small in-memory Storage
// rather than depending on a Node flag or on jsdom internals.
function createMemoryStorage() {
  const store = new Map();
  return {
    getItem: (key) => (store.has(String(key)) ? store.get(String(key)) : null),
    setItem: (key, value) => store.set(String(key), String(value)),
    removeItem: (key) => store.delete(String(key)),
    clear: () => store.clear(),
    key: (index) => [...store.keys()][index] ?? null,
    get length() {
      return store.size;
    },
  };
}

const memoryStorage = createMemoryStorage();
for (const target of [globalThis, globalThis.window].filter(Boolean)) {
  Object.defineProperty(target, 'localStorage', {
    value: memoryStorage,
    configurable: true,
    writable: true,
  });
}

// Every test starts from a clean DOM, empty storage, and no leftover stubs —
// otherwise state persisted by one test (notably the active move id)
// silently changes what the next one renders.
beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals(); // restoreAllMocks does not undo vi.stubGlobal('fetch', ...)
});
