/**
 * @vitest-environment node
 *
 * F-30 · DIS-13: los esqueletos tienen la forma real de lo que sustituyen.
 * Antes Inicio cargaba un héroe de 12 px y 16:7 que al llegar era de 28 px,
 * y las filas medían 96/128 px con huecos de 12 cuando las reales miden
 * 112/144 con 20: al cargar, todo saltaba. Aquí se compara el esqueleto con
 * las clases del componente real.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "../../..");
const read = (p: string) => readFileSync(resolve(ROOT, p), "utf8");
const APP = "src/app/[locale]/(app)";

describe("esqueletos con la forma real", () => {
  it("Inicio: héroe con el radio y la sombra de HeroSection", () => {
    const hero = read("src/components/home/HeroSection.tsx");
    const loading = read(`${APP}/home/loading.tsx`);
    for (const cls of ["rounded-bento-xl", "shadow-hard-sm", "md:shadow-hard", "md:w-64", "lg:w-80"]) {
      expect(hero).toContain(cls);
      expect(loading).toContain(cls);
    }
  });

  it.each([`${APP}/home/loading.tsx`, `${APP}/profile/[username]/loading.tsx`])(
    "%s: filas con el ancho y el hueco de MediaRow",
    (file) => {
      const row = read("src/components/home/MediaRow.tsx");
      const loading = read(file);
      for (const cls of ["w-28 md:w-36", "flex gap-5"]) {
        expect(row).toContain(cls);
        expect(loading).toContain(cls);
      }
      expect(loading).not.toMatch(/w-24 md:w-32/);
    }
  );

  it("Biblioteca: rejilla de MediaGrid y mismo ancho de retícula que la página", () => {
    const grid = read("src/components/media/MediaGrid.tsx");
    const loading = read(`${APP}/library/loading.tsx`);
    const cols = "grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3";
    expect(grid).toContain(cols);
    expect(loading).toContain(cols);
    expect(read(`${APP}/library/page.tsx`)).toContain('className="page-grid py-8"');
    expect(loading).toContain('className="page-grid py-8"');
  });

  it("Perfil: banda y avatar con la forma de ProfileHeader", () => {
    const header = read("src/components/profile/ProfileHeader.tsx");
    const loading = read(`${APP}/profile/[username]/loading.tsx`);
    for (const cls of ["h-[120px] md:h-[160px] rounded-bento-xl", "rounded-bento-xl rounded-bl-lg"]) {
      expect(header).toContain(cls);
      expect(loading).toContain(cls);
    }
  });

  it("los pósteres de los esqueletos llevan el radio de póster", () => {
    for (const file of ["home", "library", "profile/[username]", "lists/[id]"]) {
      const code = read(`${APP}/${file}/loading.tsx`);
      for (const m of code.matchAll(/className="[^"]*aspect-\[2\/3\][^"]*"/g)) expect(m[0]).toContain("rounded-2xl");
    }
  });
});
