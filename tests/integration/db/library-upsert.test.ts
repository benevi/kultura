/**
 * Tests de integración — flujo completo POST → GET de biblioteca.
 * Requiere SUPABASE_TEST_URL y SUPABASE_TEST_ANON_KEY configurados.
 *
 * Uso: npm run test:integration
 */
import { createClient } from "@supabase/supabase-js";
import { cachedClient } from "../login";
import { describe, it, expect, beforeAll, afterAll } from "vitest";

const TEST_URL = process.env.SUPABASE_TEST_URL ?? "";
const TEST_ANON_KEY = process.env.SUPABASE_TEST_ANON_KEY ?? "";
const TEST_SERVICE_KEY = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY ?? "";

const USER_EMAIL = "test-user-a@kultura.test";
const USER_PASSWORD = "TestPassword123!";

const TEST_MEDIA_ID = "movie_integration_upsert_test";

// Una sesión por usuario y fichero, con reintento ante el límite de Auth.
function clientAs(email: string, password: string) {
  return cachedClient(TEST_URL, TEST_ANON_KEY, email, password);
}

describe("Library upsert — flujo completo", () => {
  let userId: string;

  beforeAll(async () => {
    const client = await clientAs(USER_EMAIL, USER_PASSWORD);
    const { data } = await client.auth.getUser();
    userId = data.user!.id;

    // Asegurar que existe la fila en media (cache). El catálogo lo escribe el
    // servidor (F-03): con la clave de servicio si está disponible.
    const writer = TEST_SERVICE_KEY
      ? createClient(TEST_URL, TEST_SERVICE_KEY, { auth: { persistSession: false } })
      : client;
    await writer.from("media").upsert({
      id: TEST_MEDIA_ID,
      external_id: "integration_upsert_test",
      type: "movie",
      title: "Integration Upsert Test Movie",
    });

    // Una ejecución anterior que no llegó al afterAll puede haber dejado la
    // fila: se borra para que el INSERT parta de cero.
    await client.from("user_media").delete().match({ user_id: userId, media_id: TEST_MEDIA_ID });
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
    }, { onConflict: "user_id,media_id" });

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

  it("UPDATE (upsert): actualiza status y rating10 sin duplicar (como la app: nunca score)", async () => {
    const client = await clientAs(USER_EMAIL, USER_PASSWORD);

    const { error } = await client.from("user_media").upsert(
      {
        user_id: userId,
        media_id: TEST_MEDIA_ID,
        status: "completed",
        rating10: 9,
      },
      { onConflict: "user_id,media_id" }
    );

    expect(error).toBeNull();

    // Verificar que hay exactamente 1 fila (no duplicado)
    const { data, count } = await client
      .from("user_media")
      .select("status, rating10, score", { count: "exact" })
      .match({ user_id: userId, media_id: TEST_MEDIA_ID });

    expect(count).toBe(1);
    expect(data![0].status).toBe("completed");
    expect(Number(data![0].rating10)).toBe(9);
    // Mientras exista la columna, el disparador user_media_sync_rating la rellena.
    expect(data![0].score).toBe(5);
  });

  it("rating10 NULL es válido (sin puntuar)", async () => {
    const client = await clientAs(USER_EMAIL, USER_PASSWORD);

    const { error } = await client.from("user_media").upsert(
      {
        user_id: userId,
        media_id: TEST_MEDIA_ID,
        status: "in_progress",
        rating10: null,
      },
      { onConflict: "user_id,media_id" }
    );

    expect(error).toBeNull();
  });

  it("rating10 fuera de rango o de paso (11, 7,3) es rechazado por CHECK constraint", async () => {
    const client = await clientAs(USER_EMAIL, USER_PASSWORD);

    const { error } = await client.from("user_media").upsert(
      {
        user_id: userId,
        media_id: TEST_MEDIA_ID,
        status: "completed",
        rating10: 11, // Viola user_media_rating10_check (0,5-10)
      },
      { onConflict: "user_id,media_id" }
    );

    expect(error).not.toBeNull();

    const { error: stepError } = await client.from("user_media").upsert(
      { user_id: userId, media_id: TEST_MEDIA_ID, status: "completed", rating10: 7.3 },
      { onConflict: "user_id,media_id" }
    );
    expect(stepError).not.toBeNull();
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
