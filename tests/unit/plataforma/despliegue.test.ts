/**
 * Tests unitarios — configuración de despliegue y operaciones.
 * - D-09/COD-8: funciones de Vercel en Frankfurt (`fra1`), junto a Supabase
 *   (Central EU). El cron de /api/health se mantiene.
 * - `.nvmrc` = misma versión mayor de Node que CI y que el proyecto en Vercel
 *   (24.x), y compatible con `engines`.
 * - D-20: el workflow de backup existe, está cifrado y no sube nada en claro.
 */
// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const read = (p: string) => readFileSync(resolve(process.cwd(), p), "utf-8");

describe("vercel.json", () => {
  const vercel = JSON.parse(read("vercel.json"));

  it("región fra1 (misma zona que Supabase)", () => {
    expect(vercel.regions).toEqual(["fra1"]);
  });

  it("conserva el cron diario de /api/health", () => {
    expect(vercel.crons).toContainEqual({ path: "/api/health", schedule: "0 6 * * *" });
  });
});

describe(".nvmrc", () => {
  const nvmrc = read(".nvmrc").trim();
  const major = Number(nvmrc.replace(/^v/, "").split(".")[0]);

  it("misma versión mayor que CI", () => {
    const ci = /node-version:\s*['"]?(\d+)/.exec(read(".github/workflows/ci.yml"))?.[1];
    expect(major).toBe(Number(ci));
  });

  it("misma versión mayor que el proyecto de Vercel (24.x)", () => {
    expect(major).toBe(24);
  });

  it("cumple engines.node de package.json", () => {
    const engines = JSON.parse(read("package.json")).engines.node as string;
    const min = Number(/>=\s*(\d+)/.exec(engines)?.[1]);
    expect(major).toBeGreaterThanOrEqual(min);
  });
});

describe(".github/workflows/backup.yml", () => {
  const wf = read(".github/workflows/backup.yml");

  it("semanal y lanzable a mano", () => {
    expect(wf).toMatch(/schedule:[\s\S]*?- cron: "[^"]+"/);
    expect(wf).toContain("workflow_dispatch");
  });

  it("vuelca roles, esquema y datos con la URL del secreto", () => {
    expect(wf).toContain("--role-only");
    expect(wf).toContain("--data-only");
    expect(wf).toContain("secrets.SUPABASE_DB_URL");
  });

  it("cifra con age para el destinatario del secreto y sube solo el .age, 90 días", () => {
    expect(wf).toContain("secrets.BACKUP_AGE_RECIPIENT");
    expect(wf).toMatch(/age\s+(--recipient|-r)\b/);
    expect(wf).toMatch(/^\s+path: .*\*\.age$/m);
    expect(wf).not.toMatch(/^\s+path: .*\.sql/m);
    expect(wf).toContain("retention-days: 90");
  });

  it("permisos mínimos", () => {
    expect(wf).toMatch(/permissions:\s*\n\s*contents:\s*read/);
  });
});
