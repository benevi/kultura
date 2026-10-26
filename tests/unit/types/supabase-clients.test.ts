// @vitest-environment node
/**
 * Los tres clientes de Supabase (navegador, servidor y admin) van tipados con
 * `Database` (src/types/supabase.ts, generado de las migraciones). Así una
 * columna que no existe, un NOT NULL sin valor o un tipo equivocado fallan en
 * `tsc` y no en producción (al tiparlos salió un `media_type: null` en la
 * importación de listas que la base rechazaba en silencio).
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";

const ROOT = path.resolve(__dirname, "../../..");
const read = (rel: string) => readFileSync(path.join(ROOT, rel), "utf8");

describe("clientes de Supabase tipados", () => {
  it.each([
    ["src/lib/supabase/client.ts", "createBrowserClient<Database>("],
    ["src/lib/supabase/server.ts", "createServerClient<Database>("],
    ["src/lib/supabase/admin.ts", "createSupabaseClient<Database>("],
  ])("%s usa %s", (file, call) => {
    const source = read(file);
    expect(source).toContain(call);
    expect(source).toMatch(/import type \{ Database \} from ["']@\/types\/supabase["']/);
  });

  it("sin casts a Json: las columnas jsonb reciben tipos `type` (EpisodeProgress) o una ida y vuelta por JSON", () => {
    expect(() => read("src/lib/supabase/json.ts")).toThrow();
    expect(read("src/types/library.ts")).toMatch(/export type EpisodeProgress = \{/);
    expect(read("src/lib/claude/daily-recs.ts")).toMatch(/export type AiRecsResult = \{/);
    expect(read("src/app/api/account/export/collect.ts")).not.toContain("as unknown as");
  });

  it("el perfil no se inventa la fecha de alta si la columna viene nula", () => {
    const page = read("src/app/[locale]/(app)/profile/[username]/page.tsx");
    expect(page).toContain("createdAt={profileUser.created_at}");
    expect(page).not.toMatch(/created_at \?\? new Date\(/);
  });

  it("los normalizadores de TMDB aceptan el elemento de listado sin cast a la ficha", () => {
    for (const file of ["src/app/api/search/route.ts", "src/lib/import/server/match.ts", "src/lib/api/anime-tmdb.ts"]) {
      expect(read(file), file).not.toMatch(/as Tmdb(Movie|TV)Detail\b/);
    }
  });
});
