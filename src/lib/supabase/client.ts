import { createBrowserClient } from "@supabase/ssr";

/**
 * Cliente Supabase para uso en Client Components.
 * Gestiona la sesión via cookies del browser.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
