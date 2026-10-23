/**
 * Tests de integración para el trigger handle_new_user().
 * Requiere SUPABASE_TEST_URL y SUPABASE_TEST_ANON_KEY en .env.local
 * y permisos para crear usuarios en auth.users (service role key).
 */
import { createClient } from "@supabase/supabase-js";
import { describe, it, expect, afterEach } from "vitest";

const TEST_URL = process.env.SUPABASE_TEST_URL ?? "";
const TEST_ANON_KEY = process.env.SUPABASE_TEST_ANON_KEY ?? "";

// Nota: para limpiar usuarios creados en tests necesitamos service role
// El trigger se verifica indirectamente: tras signup, el perfil existe en users

describe("Trigger — handle_new_user()", () => {
  const testEmail = `trigger-test-${Date.now()}@kultura.test`;
  const testPassword = "TriggerTest123!";

  afterEach(async () => {
    // Cleanup: el usuario de test permanece hasta limpieza manual del proyecto test
    // En CI se usa un proyecto limpio por run
  });

  it("crea fila en users automáticamente al registrarse", async () => {
    const client = createClient(TEST_URL, TEST_ANON_KEY);

    const { data, error } = await client.auth.signUp({
      email: testEmail,
      password: testPassword,
    });

    expect(error).toBeNull();
    expect(data.user).not.toBeNull();

    const userId = data.user!.id;

    // Pequeña espera para que el trigger se ejecute
    await new Promise((r) => setTimeout(r, 500));

    const { data: profile, error: profileError } = await client
      .from("users")
      .select("id, username, avatar_initials, avatar_color")
      .eq("id", userId)
      .single();

    expect(profileError).toBeNull();
    expect(profile).not.toBeNull();
    expect(profile!.id).toBe(userId);
    expect(typeof profile!.username).toBe("string");
    expect(profile!.username.length).toBeGreaterThan(0);
    expect(profile!.avatar_initials.length).toBeGreaterThan(0);
    // F-12: color de la paleta (antes, el rojo fijo #E82020).
    expect(["slate", "red", "orange", "amber", "green", "teal", "blue", "purple"]).toContain(
      profile!.avatar_color
    );
  });

  // F-12 (R4): el nombre público YA NO sale del email.
  it("el username es u_ + 6 caracteres y no contiene nada del email", async () => {
    const uniqueEmail = `johndoe_${Date.now()}@example.com`;
    const client = createClient(TEST_URL, TEST_ANON_KEY);

    const { data } = await client.auth.signUp({
      email: uniqueEmail,
      password: testPassword,
    });

    await new Promise((r) => setTimeout(r, 500));

    const { data: profile } = await client
      .from("users")
      .select("username")
      .eq("id", data.user!.id)
      .single();

    expect(profile?.username).toMatch(/^u_[a-z0-9]{6}$/);
    expect(profile?.username).not.toContain("johndoe");
  });

  it("no genera usernames duplicados si el email-prefix ya existe", async () => {
    const client = createClient(TEST_URL, TEST_ANON_KEY);
    const base = `duptest_${Date.now()}`;

    const { data: user1 } = await client.auth.signUp({
      email: `${base}@domain1.com`,
      password: testPassword,
    });
    const { data: user2 } = await client.auth.signUp({
      email: `${base}@domain2.com`,
      password: testPassword,
    });

    await new Promise((r) => setTimeout(r, 800));

    const { data: profiles } = await client
      .from("users")
      .select("username")
      .in("id", [user1.user!.id, user2.user!.id]);

    const usernames = profiles?.map((p) => p.username) ?? [];
    expect(new Set(usernames).size).toBe(2); // deben ser distintos
  });
});
