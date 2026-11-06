/**
 * Cliente de Supabase bajo demanda (REN-9): las pantallas de acceso no cargan
 * GoTrue en el primer pintado, solo al pulsar un botón o tras pintar. El
 * `import()` se hace una vez y se reutiliza.
 */
let clientModule: Promise<typeof import("@/lib/supabase/client")> | null = null;

export async function getSupabase() {
  clientModule ??= import("@/lib/supabase/client");
  const { createClient } = await clientModule;
  return createClient();
}
