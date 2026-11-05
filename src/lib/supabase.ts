import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Read from env vars or localStorage override
export function getSupabaseCredentials(): { url: string; anonKey: string } {
  const customUrl = typeof window !== 'undefined' ? localStorage.getItem('spiceguard_supabase_url') : null;
  const customKey = typeof window !== 'undefined' ? localStorage.getItem('spiceguard_supabase_anon_key') : null;

  const url = customUrl || (import.meta.env.VITE_SUPABASE_URL as string) || '';
  const anonKey = customKey || (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || '';

  return { url: url.trim(), anonKey: anonKey.trim() };
}

export function isSupabaseConfigured(): boolean {
  const { url, anonKey } = getSupabaseCredentials();
  return (
    Boolean(url) &&
    Boolean(anonKey) &&
    url.startsWith('https://') &&
    !url.includes('your-project') &&
    anonKey.length > 20
  );
}

let supabaseInstance: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) {
    return null;
  }

  const { url, anonKey } = getSupabaseCredentials();

  if (!supabaseInstance) {
    try {
      supabaseInstance = createClient(url, anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
        realtime: {
          params: {
            eventsPerSecond: 10,
          },
        },
      });
    } catch (e) {
      console.warn('Failed to initialize Supabase client:', e);
      return null;
    }
  }

  return supabaseInstance;
}

export function setCustomSupabaseCredentials(url: string, anonKey: string): void {
  if (typeof window !== 'undefined') {
    if (url && anonKey) {
      localStorage.setItem('spiceguard_supabase_url', url.trim());
      localStorage.setItem('spiceguard_supabase_anon_key', anonKey.trim());
    } else {
      localStorage.removeItem('spiceguard_supabase_url');
      localStorage.removeItem('spiceguard_supabase_anon_key');
    }
    supabaseInstance = null;
  }
}
