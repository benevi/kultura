// ============================================================
// KULTURA — Validación de env con Zod (E24)
// ============================================================

import { describe, it, expect, afterEach, vi } from "vitest";
import { parseServerEnv } from "@/lib/env";

// Valores válidos mínimos para que serverSchema pase.
const VALID = {
  SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
  TMDB_API_KEY: "tmdb-key",
  RAWG_API_KEY: "rawg-key",
};

describe("parseServerEnv", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("schema válido (solo requeridas) → parsea y devuelve valores", () => {
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", VALID.SUPABASE_SERVICE_ROLE_KEY);
    vi.stubEnv("TMDB_API_KEY", VALID.TMDB_API_KEY);
    vi.stubEnv("RAWG_API_KEY", VALID.RAWG_API_KEY);
    // opcionales ausentes (undefined → optional las salta)
    vi.stubEnv("ANTHROPIC_API_KEY", undefined);
    vi.stubEnv("COMICVINE_KEY", undefined);

    const env = parseServerEnv();
    expect(env.TMDB_API_KEY).toBe(VALID.TMDB_API_KEY);
    expect(env.RAWG_API_KEY).toBe(VALID.RAWG_API_KEY);
    expect(env.SUPABASE_SERVICE_ROLE_KEY).toBe(VALID.SUPABASE_SERVICE_ROLE_KEY);
    // Las opcionales vacías → undefined (string vacío no pasa stub como set).
    expect(env.ANTHROPIC_API_KEY).toBeUndefined();
    expect(env.COMICVINE_KEY).toBeUndefined();
  });

  it("opcionales válidas se aceptan", () => {
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", VALID.SUPABASE_SERVICE_ROLE_KEY);
    vi.stubEnv("TMDB_API_KEY", VALID.TMDB_API_KEY);
    vi.stubEnv("RAWG_API_KEY", VALID.RAWG_API_KEY);
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-abc123");
    vi.stubEnv("COMICVINE_KEY", "cv-key");

    const env = parseServerEnv();
    expect(env.ANTHROPIC_API_KEY).toBe("sk-ant-abc123");
    expect(env.COMICVINE_KEY).toBe("cv-key");
  });

  it("falta una var crítica → error que nombra la var", () => {
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", VALID.SUPABASE_SERVICE_ROLE_KEY);
    vi.stubEnv("RAWG_API_KEY", VALID.RAWG_API_KEY);
    // TMDB_API_KEY ausente
    vi.stubEnv("TMDB_API_KEY", "");

    expect(() => parseServerEnv()).toThrow(/TMDB_API_KEY/);
  });

  it("varias vars faltan → el error las lista todas", () => {
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    vi.stubEnv("TMDB_API_KEY", "");
    vi.stubEnv("RAWG_API_KEY", "");

    try {
      parseServerEnv();
      throw new Error("no debería llegar aquí");
    } catch (e) {
      const msg = (e as Error).message;
      expect(msg).toMatch(/SUPABASE_SERVICE_ROLE_KEY/);
      expect(msg).toMatch(/TMDB_API_KEY/);
      expect(msg).toMatch(/RAWG_API_KEY/);
    }
  });

  it("ANTHROPIC_API_KEY con formato inválido → error nombra la var", () => {
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", VALID.SUPABASE_SERVICE_ROLE_KEY);
    vi.stubEnv("TMDB_API_KEY", VALID.TMDB_API_KEY);
    vi.stubEnv("RAWG_API_KEY", VALID.RAWG_API_KEY);
    vi.stubEnv("ANTHROPIC_API_KEY", "wrong-prefix-key");

    expect(() => parseServerEnv()).toThrow(/ANTHROPIC_API_KEY/);
  });
});
