import "@testing-library/jest-dom";

// Defaults de env para tests unitarios: cualquier módulo que importe
// `@/lib/env` valida estos valores al cargar (E24). Valores dummy válidos
// según el schema Zod — los tests mockean fetch, así que no se usan de verdad.
process.env.NEXT_PUBLIC_SUPABASE_URL ??= "https://test.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "test-anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";
process.env.TMDB_API_KEY ??= "test-tmdb-key";
process.env.RAWG_API_KEY ??= "test-rawg-key";
process.env.COMICVINE_KEY ??= "test-comicvine-key";
