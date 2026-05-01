/**
 * Tests de integración — flujo completo POST → GET de biblioteca.
 * Requiere SUPABASE_TEST_URL y SUPABASE_TEST_ANON_KEY configurados.
 *
 * Uso: npm run test:integration
 */
import { createClient } from "@supabase/supabase-js";
import { describe, it, expect, beforeAll, afterAll } from "vitest";

const TEST_URL = process.env.SUPABASE_TEST_URL ?? "";
const TEST_ANON_KEY = process.env.SUPABASE_TEST_ANON_KEY ?? "";

const USER_EMAIL = "test-user-a@kultura.test";
const USER_PASSWORD = "TestPassword123!";

const TEST_MEDIA_ID = "movie_integration_upsert_test";

async function clientAs(email: string, password: string) {
  const client = createClient(TEST_URL, TEST_ANON_KEY);
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`Login failed for ${email}: ${error.message}`);
  return client;
}

describe("Library upsert — flujo completo", () => {
  let userId: string;

  beforeAll(async () => {
    const client = await clientAs(USER_EMAIL, USER_PASSWORD);
    const { data } = await client.auth.getUser();
    userId = data.user!.id;

    // Asegurar que existe la fila en media (cache)
    await client.from("media").upsert({
      id: TEST_MEDIA_ID,
      external_id: "integration_upsert_test",
      type: "movie",
      title: "Integration Upsert Test Movie",
    });
  });

  afterAll(async () => {
    // Limpiar la entrada creada en los tests
    const client = await clientAs(USER_EMAIL, USER_PASSWORD);
    await client
      .from("user_media")
      .delete()
      .match({ user_id: userId, media_id: TEST_MEDIA_ID });
  });

  it("INSERT: crea nueva entrada en user_media", async () => {
    const client = await clientAs(USER_EMAIL, USER_PASSWORD);

    const { error } = await client.from("user_media").upsert({
      user_id: userId,
      media_id: TEST_MEDIA_ID,
      status: "pending",
    });

    expect(error).toBeNull();
  });

  it("SELECT: la entrada es visible para el mismo usuario", async () => {
    const client = await clientAs(USER_EMAIL, USER_PASSWORD);

    const { data, error } = await client
      .from("user_media")
      .select("user_id, media_id, status")
      .match({ user_id: userId, media_id: TEST_MEDIA_ID })
      .single();

    expect(error).toBeNull();
    expect(data).not.toBeNull();
    expect(data!.media_id).toBe(TEST_MEDIA_ID);
    expect(data!.status).toBe("pending");
  });

  it("UPDATE (upsert): actualiza status y score sin duplicar", async () => {
    const client = await clientAs(USER_EMAIL, USER_PASSWORD);

    const { error } = await client.from("user_media").upsert(
      {
        user_id: userId,
        media_id: TEST_MEDIA_ID,
        status: "completed",
        score: 5,
      },
      { onConflict: "user_id,media_id" }
    );

    expect(error).toBeNull();

    // Verificar que hay exactamente 1 fila (no duplicado)
    const { data, count } = await client
      .from("user_media")
      .select("status, score", { count: "exact" })
      .match({ user_id: userId, media_id: TEST_MEDIA_ID });

    expect(count).toBe(1);
    expect(data![0].status).toBe("completed");
    expect(data![0].score).toBe(5);
  });

  it("score NULL es válido (sin puntuar)", async () => {
    const client = await clientAs(USER_EMAIL, USER_PASSWORD);

    const { error } = await client.from("user_media").upsert(
      {
        user_id: userId,
        media_id: TEST_MEDIA_ID,
        status: "in_progress",
        score: null,
      },
      { onConflict: "user_id,media_id" }
    );

    expect(error).toBeNull();
  });

  it("score fuera de rango (0 o 6) es rechazado por CHECK constraint", async () => {
    const client = await clientAs(USER_EMAIL, USER_PASSWORD);

    const { error } = await client.from("user_media").upsert(
      {
        user_id: userId,
        media_id: TEST_MEDIA_ID,
        status: "completed",
        score: 6, // Viola CHECK (score between 1 and 5)
      },
      { onConflict: "user_id,media_id" }
    );

    expect(error).not.toBeNull();
  });

  it("status inválido es rechazado por CHECK constraint", async () => {
    const client = await clientAs(USER_EMAIL, USER_PASSWORD);

    const { error } = await client.from("user_media").insert({
      user_id: userId,
      media_id: "movie_fake_check",
      status: "watching", // No está en el enum
    });

    expect(error).not.toBeNull();
  });

  it("DELETE: elimina correctamente la entrada", async () => {
    const client = await clientAs(USER_EMAIL, USER_PASSWORD);

    const { error } = await client
      .from("user_media")
      .delete()
      .match({ user_id: userId, media_id: TEST_MEDIA_ID });

    expect(error).toBeNull();

    // Verificar que ya no existe
    const { data } = await client
      .from("user_media")
      .select("id")
      .match({ user_id: userId, media_id: TEST_MEDIA_ID });

    expect(data).toHaveLength(0);
  });
});
