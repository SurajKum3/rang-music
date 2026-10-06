const VISITOR_KEY = 'rang:visitor';

let memoryId: string | null = null;

const randomId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;

// Anonymous, random, and carries nothing about the person. Stored in
// localStorage so every tab of the same browser shares one ID and is
// counted once. Falls back to a per-tab ID when storage is blocked.
export function getVisitorId(): string {
  if (memoryId) return memoryId;
  try {
    const saved = localStorage.getItem(VISITOR_KEY);
    if (saved) return (memoryId = saved);
    const fresh = randomId();
    localStorage.setItem(VISITOR_KEY, fresh);
    return (memoryId = fresh);
  } catch {
    return (memoryId = randomId());
  }
}
