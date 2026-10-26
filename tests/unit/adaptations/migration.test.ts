// ============================================================
// F-29 · Migración 20261215290001_adaptations.sql (estática)
// La prueba contra Postgres 16 (aplicada dos veces, RLS, privilegios y
// rls_audit) se hizo en local; aquí se fija lo que no puede romperse.
// ============================================================

// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { stripComments } from "../rls/migration-lint";

const FILE = path.resolve(__dirname, "../../../supabase/migrations/20261215290001_adaptations.sql");
const raw = readFileSync(FILE, "utf8");
const sql = stripComments(raw).replace(/\s+/g, " ").toLowerCase();

describe("migración de media_adaptations", () => {
  it("empieza explicando qué hace y cómo comprobarlo", () => {
    expect(raw.startsWith("-- ")).toBe(true);
    expect(raw).toMatch(/QUÉ HACE/);
    expect(raw).toMatch(/COMPROBACIÓN/);
  });

  it("idempotente: if not exists, drop policy if exists antes de crear, constraints con guarda", () => {
    expect(sql).toContain("create table if not exists public.media_adaptations");
    expect(sql).toContain("create index if not exists media_adaptations_expires_at_idx");
    expect(sql).toContain('drop policy if exists "media_adaptations_select_all"');
    for (const c of ["media_id_check", "subject_qid_check", "links_check", "status_check"]) {
      expect(sql).toContain(`conname = 'media_adaptations_${c}'`);
    }
  });

  it("RLS: lectura para anon y authenticated; escritura solo service role", () => {
    expect(sql).toContain("alter table public.media_adaptations enable row level security");
    expect(sql).toContain("revoke all on public.media_adaptations from public, anon, authenticated");
    expect(sql).toContain("grant select on public.media_adaptations to anon, authenticated");
    expect(sql).toMatch(/for select to anon, authenticated using \(true\)/);
    expect(sql).not.toMatch(/grant (insert|update|delete|all)[^;]*to (anon|authenticated)/);
    // Ninguna política PERMISIVA de escritura (las demo_no_* son restrictivas).
    expect(sql).not.toMatch(/create policy "media_adaptations[^;]*for (insert|update|delete|all)/);
    expect([...sql.matchAll(/create policy "([^"]+)"/g)].map((m) => m[1])).toEqual(["media_adaptations_select_all"]);
  });

  it("el bloque demo_no_* va después de crear la tabla", () => {
    expect(sql.indexOf("demo_no_insert")).toBeGreaterThan(sql.indexOf("create table if not exists public.media_adaptations"));
  });
});
