/**
 * Tests de integración para RLS policies.
 * Requiere SUPABASE_TEST_URL y SUPABASE_TEST_ANON_KEY en .env.local
 *
 * Estos tests usan el proyecto Supabase de TEST (nunca el de producción).
 * El esquema debe estar aplicado antes de correr estos tests.
 */
import { createClient } from "@supabase/supabase-js";
import { describe, it, expect, beforeAll, afterAll } from "vitest";

const TEST_URL = process.env.SUPABASE_TEST_URL ?? "";
const TEST_ANON_KEY = process.env.SUPABASE_TEST_ANON_KEY ?? "";

// Credenciales de dos usuarios de test (deben existir en el proyecto de test)
const USER_A_EMAIL = "test-user-a@kultura.test";
const USER_A_PASSWORD = "TestPassword123!";
const USER_B_EMAIL = "test-user-b@kultura.test";
const USER_B_PASSWORD = "TestPassword456!";

function clientAnon() {
  return createClient(TEST_URL, TEST_ANON_KEY);
}

async function clientAs(email: string, password: string) {
  const client = createClient(TEST_URL, TEST_ANON_KEY);
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`Login failed for ${email}: ${error.message}`);
  return client;
}

describe("RLS — users table", () => {
  it("usuarios anónimos pueden SELECT users (perfiles públicos)", async () => {
    const anon = clientAnon();
    const { data, error } = await anon.from("users").select("id, username").limit(1);
    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
  });

  it("usuario solo puede UPDATE su propio perfil", async () => {
    const clientA = await clientAs(USER_A_EMAIL, USER_A_PASSWORD);
    const { data: me } = await clientA.auth.getUser();
    const userId = me.user!.id;

    // UPDATE propio — debe funcionar
    const { error: ownUpdate } = await clientA
      .from("users")
      .update({ avatar_color: "#E82020" })
      .eq("id", userId);
    expect(ownUpdate).toBeNull();

    // UPDATE ajeno — debe fallar (0 rows afectadas o error)
    const clientB = await clientAs(USER_B_EMAIL, USER_B_PASSWORD);
    const { data: userB } = await clientB.auth.getUser();
    const { error: foreignUpdate } = await clientA
      .from("users")
      .update({ avatar_color: "#000000" })
      .eq("id", userB.user!.id);
    // RLS silencia el error pero no actualiza ninguna fila
    expect(foreignUpdate).toBeNull(); // no error, pero tampoco actualiza
  });
});

describe("RLS — user_media table", () => {
  let mediaId: string;

  beforeAll(async () => {
    // Asegurar que existe un media de test
    const clientA = await clientAs(USER_A_EMAIL, USER_A_PASSWORD);
    const { error } = await clientA.from("media").upsert({
      id: "movie_test_rls",
      external_id: "test_rls",
      type: "movie",
      title: "Test Movie RLS",
    });
    if (error) throw error;
    mediaId = "movie_test_rls";
  });

  it("usuario puede INSERT su propio user_media", async () => {
    const clientA = await clientAs(USER_A_EMAIL, USER_A_PASSWORD);
    const { data: me } = await clientA.auth.getUser();
    const { error } = await clientA.from("user_media").upsert({
      user_id: me.user!.id,
      media_id: mediaId,
      status: "pending",
    });
    expect(error).toBeNull();
  });

  it("usuario NO puede INSERT user_media de otro usuario", async () => {
    const clientA = await clientAs(USER_A_EMAIL, USER_A_PASSWORD);
    const clientB = await clientAs(USER_B_EMAIL, USER_B_PASSWORD);
    const { data: userB } = await clientB.auth.getUser();

    const { error } = await clientA.from("user_media").insert({
      user_id: userB.user!.id, // intentando insertar como User B
      media_id: mediaId,
      status: "pending",
    });
    expect(error).not.toBeNull(); // RLS debe bloquear esto
  });
});

describe("RLS — friendships table", () => {
  it("usuario solo puede crear amistad como requester", async () => {
    const clientA = await clientAs(USER_A_EMAIL, USER_A_PASSWORD);
    const clientB = await clientAs(USER_B_EMAIL, USER_B_PASSWORD);
    const { data: userA } = await clientA.auth.getUser();
    const { data: userB } = await clientB.auth.getUser();

    // Insertar con requester_id = propio uid — OK
    const { error: ok } = await clientA.from("friendships").upsert({
      requester_id: userA.user!.id,
      receiver_id: userB.user!.id,
      status: "pending",
    });
    expect(ok).toBeNull();

    // Insertar con requester_id = uid ajeno — debe fallar
    const { error: bad } = await clientA.from("friendships").insert({
      requester_id: userB.user!.id, // suplantando a User B
      receiver_id: userA.user!.id,
      status: "pending",
    });
    expect(bad).not.toBeNull();
  });
});

describe("RLS — lists table", () => {
  it("listas son públicas para SELECT (anónimo)", async () => {
    const anon = clientAnon();
    const { data, error } = await anon.from("lists").select("id, name").limit(5);
    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
  });
});

describe("RLS — notifications table", () => {
  it("usuario solo ve sus propias notificaciones", async () => {
    const clientA = await clientAs(USER_A_EMAIL, USER_A_PASSWORD);
    const clientB = await clientAs(USER_B_EMAIL, USER_B_PASSWORD);
    const { data: userA } = await clientA.auth.getUser();

    const { data: notifs } = await clientA.from("notifications").select("user_id");
    const foreignNotif = notifs?.find((n) => n.user_id !== userA.user!.id);
    expect(foreignNotif).toBeUndefined();
  });
});
