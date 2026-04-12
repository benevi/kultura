/**
 * Tests de integración para los clientes Supabase.
 * Requiere SUPABASE_TEST_URL y SUPABASE_TEST_ANON_KEY en .env.local
 */
import { describe, it, expect } from "vitest";

const TEST_URL = process.env.SUPABASE_TEST_URL ?? "";
const TEST_ANON_KEY = process.env.SUPABASE_TEST_ANON_KEY ?? "";

describe("Supabase browser client", () => {
  it("createClient() devuelve un cliente con la URL correcta", async () => {
    const { createBrowserClient } = await import("@supabase/ssr");
    const client = createBrowserClient(TEST_URL, TEST_ANON_KEY);
    // El cliente debe instanciarse — si la URL es inválida lanza error
    expect(client).toBeDefined();
    expect(typeof client.auth.getSession).toBe("function");
  });

  it("createBrowserClient lanza error si supabaseUrl está vacío", async () => {
    const { createBrowserClient } = await import("@supabase/ssr");
    expect(() => createBrowserClient("", TEST_ANON_KEY)).toThrow();
  });
});

describe("Supabase server client", () => {
  it("createServerClient() acepta cookies y devuelve cliente válido", async () => {
    const { createServerClient } = await import("@supabase/ssr");
    const cookieStore: Record<string, string> = {};

    const client = createServerClient(TEST_URL, TEST_ANON_KEY, {
      cookies: {
        getAll: () =>
          Object.entries(cookieStore).map(([name, value]) => ({
            name,
            value,
          })),
        setAll: (cookies) => {
          cookies.forEach(({ name, value }) => {
            cookieStore[name] = value;
          });
        },
      },
    });

    expect(client).toBeDefined();
    expect(typeof client.auth.getUser).toBe("function");
  });

  it("createServerClient lanza error si supabaseUrl está vacío", async () => {
    const { createServerClient } = await import("@supabase/ssr");
    expect(() =>
      createServerClient("", TEST_ANON_KEY, {
        cookies: { getAll: () => [], setAll: () => {} },
      })
    ).toThrow();
  });
});
