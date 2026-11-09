import { vi } from "vitest";
import "@testing-library/jest-dom";

// Defaults de env para tests unitarios: cualquier módulo que importe
// `@/lib/env.public` / `@/lib/env.server` validan estos valores al cargar (E24). Valores dummy válidos
// según el schema Zod — los tests mockean fetch, así que no se usan de verdad.
//
// Vars con validación de FORMATO (.startsWith / .url) se SOBREESCRIBEN siempre
// (=), no `??=`: un placeholder inyectado por CI con formato inválido
// (p.ej. ANTHROPIC_API_KEY sin prefijo sk-ant-) rompería el parse. Las de
// formato libre (.min(1)) usan `??=` y respetan lo que ya venga del entorno.
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "test-anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";
process.env.TMDB_API_KEY ??= "test-tmdb-key";
process.env.RAWG_API_KEY ??= "test-rawg-key";
process.env.COMICVINE_KEY ??= "test-comicvine-key";
process.env.ANTHROPIC_API_KEY = "sk-ant-test-key";

// UI v2: `V2Scope` lee cookies y es asíncrono, y los tests de layouts pintan con
// RTL fuera de una petición. Aquí no hace nada; su test propio lo desactiva con
// `vi.unmock` (tests/unit/ui-v2/v2-scope.test.tsx).
vi.mock("@/v2/V2Scope", () => ({
  V2Scope: ({ children }: { children: unknown }) => children,
}));
