// Doble de `unstable_cache` con la semántica que importa aquí: guarda lo que
// la función DEVUELVE y no guarda lo que LANZA (igual que Next).
export const cacheStore = new Map<string, unknown>();

export function fakeUnstableCache<T>(
  fn: () => Promise<T>,
  keyParts: string[]
): () => Promise<T> {
  return async () => {
    const key = JSON.stringify(keyParts);
    if (cacheStore.has(key)) return cacheStore.get(key) as T;
    const value = await fn();
    cacheStore.set(key, value);
    return value;
  };
}
