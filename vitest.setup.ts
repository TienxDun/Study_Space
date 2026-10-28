// Node 26 gan `localStorage` vao globalThis va tra undefined khi thieu
// `--localstorage-file`; getter nay de len ban cua happy-dom nen test DOM
// goi localStorage.clear() bi loi. Bu lai bang mot Storage trong RAM.
function createStorage(): Storage {
  const items = new Map<string, string>();
  return {
    get length() {
      return items.size;
    },
    clear() {
      items.clear();
    },
    getItem(key: string) {
      const k = String(key);
      return items.has(k) ? (items.get(k) as string) : null;
    },
    key(index: number) {
      return Array.from(items.keys())[index] ?? null;
    },
    removeItem(key: string) {
      items.delete(String(key));
    },
    setItem(key: string, value: string) {
      items.set(String(key), String(value));
    },
  } as Storage;
}

if (typeof window !== "undefined") {
  const target = window as unknown as Record<string, Storage | undefined>;
  for (const name of ["localStorage", "sessionStorage"]) {
    if (target[name]) continue;
    const storage = createStorage();
    Object.defineProperty(globalThis, name, {
      value: storage,
      configurable: true,
      writable: true,
    });
    Object.defineProperty(target, name, {
      value: storage,
      configurable: true,
      writable: true,
    });
  }
}
