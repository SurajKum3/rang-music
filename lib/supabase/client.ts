import type { SupabaseClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
// The publishable key is the one meant for browsers. The old name is still
// read so an existing deployment keeps working until its env is renamed.
const candidateKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Anything in a NEXT_PUBLIC_* variable is compiled into the JavaScript every
// visitor downloads. If a secret / service_role key was pasted here by mistake,
// refuse to use it — and say so — rather than quietly shipping admin access.
function isSecretKey(key: string) {
  if (key.startsWith('sb_secret_')) return true;
  try {
    const payload = key.split('.')[1];
    if (!payload) return false;
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(json).role === 'service_role';
  } catch {
    return false;
  }
}

const leaked = Boolean(candidateKey && isSecretKey(candidateKey));
if (leaked) {
  console.error(
    '[RANG] The Supabase key in NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is a secret/service_role key. ' +
    'It has been ignored. Replace it with the publishable (anon) key and rotate the secret in the Supabase dashboard.',
  );
}
const publishableKey = leaked ? undefined : candidateKey;

export const supabaseConfigured = Boolean(url && publishableKey);

let clientPromise: Promise<SupabaseClient | null> | null = null;

// Browser-only, and loaded on demand so the SDK never sits in the path of
// the first render. Resolves to null when Supabase is not configured or the
// SDK fails to load — callers treat that as "feature unavailable".
export function getSupabase(): Promise<SupabaseClient | null> {
  if (!supabaseConfigured || typeof window === 'undefined') return Promise.resolve(null);
  clientPromise ??= import('@supabase/supabase-js')
    .then(({ createClient }) => createClient(url!, publishableKey!, {
      // RANG has no accounts: nothing to persist, refresh or read from the URL.
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    }))
    .catch(() => { clientPromise = null; return null; });
  return clientPromise;
}
