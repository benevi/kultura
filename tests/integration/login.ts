// ============================================================
// Inicio de sesión de los tests de integración contra kultura-test.
//
// Supabase Auth limita los inicios de sesión por IP. La suite entera abre
// decenas de sesiones desde la misma máquina de CI y, pasado el cupo, Auth
// responde «Request rate limit reached» y los tests fallan por eso y no por
// el código. Dos medidas:
//   1. `cachedClient`: una sesión por usuario y fichero (los tests antiguos de
//      `db/` iniciaban sesión en cada test).
//   2. `signInWithRetry`: ante el límite, espera y reintenta (hasta ~3 min).
// ============================================================

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const RATE_LIMITED = /rate limit/i;
const WAITS_MS = [5_000, 15_000, 30_000, 60_000, 60_000];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function signInWithRetry(client: SupabaseClient, email: string, password: string): Promise<void> {
  for (let attempt = 0; ; attempt++) {
    const { error } = await client.auth.signInWithPassword({ email, password });
    if (!error) return;
    if (!RATE_LIMITED.test(error.message) || attempt >= WAITS_MS.length) {
      throw new Error(`Login failed for ${email}: ${error.message}`);
    }
    await sleep(WAITS_MS[attempt]);
  }
}

const cache = new Map<string, Promise<SupabaseClient>>();

/** Cliente con sesión de `email`, uno por usuario (y por fichero de test). */
export function cachedClient(url: string, anonKey: string, email: string, password: string): Promise<SupabaseClient> {
  const key = `${url}|${email}`;
  let client = cache.get(key);
  if (!client) {
    client = (async () => {
      const c = createClient(url, anonKey);
      await signInWithRetry(c, email, password);
      return c;
    })();
    cache.set(key, client);
    // Un fallo no se queda en caché: el siguiente test lo vuelve a intentar.
    client.catch(() => cache.delete(key));
  }
  return client;
}
