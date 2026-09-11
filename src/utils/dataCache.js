const memoryCache = {};

export function getCachedData(key) {
  if (!key) return null;
  if (memoryCache[key] !== undefined) {
    return memoryCache[key];
  }
  try {
    const raw = sessionStorage.getItem(`cache_${key}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      memoryCache[key] = parsed;
      return parsed;
    }
  } catch (e) {
    console.warn("Failed to read cache from sessionStorage", e);
  }
  return null;
}

export function setCachedData(key, data) {
  if (!key) return;
  memoryCache[key] = data;
  try {
    sessionStorage.setItem(`cache_${key}`, JSON.stringify(data));
  } catch (e) {
    console.warn("Failed to write cache to sessionStorage", e);
  }
}

export function invalidateCache(key) {
  if (!key) return;
  delete memoryCache[key];
  try {
    sessionStorage.removeItem(`cache_${key}`);
  } catch (e) {
    console.warn("Failed to invalidate cache", e);
  }
}

/**
 * Stale-while-revalidate data loading helper:
 * Immediately returns cached data if available (0ms load time),
 * then fetches latest data from Firestore and updates cache.
 */
export async function loadWithCache(key, fetcherFn, onData, onError) {
  if (!key) return;

  const cached = getCachedData(key);
  if (cached !== null && cached !== undefined) {
    onData(cached, true);
  }

  try {
    const fresh = await fetcherFn();
    setCachedData(key, fresh);
    onData(fresh, false);
    return fresh;
  } catch (err) {
    console.error(`Error loading cached data for key "${key}":`, err);
    if (onError && (cached === null || cached === undefined)) {
      onError(err);
    }
  }
}
