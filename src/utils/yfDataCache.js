import { collection, getDocs } from "firebase/firestore";
import { getCachedData, setCachedData, invalidateCache, loadWithCache } from "./dataCache";

const getCacheKey = (eventId) => `yf_colleges_${eventId}`;

export function getCachedColleges(eventId) {
  return getCachedData(getCacheKey(eventId));
}

export function setCachedColleges(eventId, data) {
  setCachedData(getCacheKey(eventId), data);
}

export function invalidateCachedColleges(eventId) {
  invalidateCache(getCacheKey(eventId));
}

export async function loadCollegesWithCache(eventId, db, onData, onError) {
  if (!eventId) return;
  return loadWithCache(
    getCacheKey(eventId),
    async () => {
      const snap = await getDocs(collection(db, "events", eventId, "yf_colleges"));
      return Promise.all(
        snap.docs.map(async (d) => {
          const participants = (
            await getDocs(
              collection(db, "events", eventId, "yf_colleges", d.id, "participants")
            )
          ).docs.map((p) => ({ id: p.id, ...p.data() }));
          return { id: d.id, ...d.data(), participants };
        })
      );
    },
    onData,
    onError
  );
}
