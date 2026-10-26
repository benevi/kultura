/**
 * F-24 · Notas finas y diario contra el proyecto Supabase de TEST (con
 * 20261208240001_rating10_logs.sql aplicada). Se salta sin SUPABASE_TEST_*.
 * Sin base remota, los mismos casos van en local-pg-cases.sql (Postgres local).
 *
 * Aceptación: score 3 → rating10 6 y viceversa; un revisionado con fecha y
 * reseña; un 4,5 de Letterboxd se guarda como 9 sin pérdida; nadie más lee el
 * diario; la demo no escribe en él.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { letterboxdToRating10, rating10ToScore } from "@/lib/library/rating";
import { adminClient, configured, createUser, deleteCreatedUsers, type TestUser } from "../rls/helpers";

describe.skipIf(!configured)("F-24 notas finas y diario (proyecto de test)", () => {
  let owner: TestUser;
  let other: TestUser;
  let demo: TestUser;

  beforeAll(async () => {
    owner = await createUser("f24-owner");
    other = await createUser("f24-other");
    demo = await createUser("f24-demo", { demo: true });
    await adminClient()
      .from("media")
      .upsert({ id: "movie_f24_int", external_id: "f24_int", type: "movie", title: "F24" });
  });

  afterAll(async () => {
    await deleteCreatedUsers();
  });

  const row = async (u: TestUser) =>
    (await u.client.from("user_media").select("score, rating10").eq("user_id", u.id).eq("media_id", "movie_f24_int").single()).data;

  it("score 3 → rating10 6 y rating10 → score", async () => {
    const { error } = await owner.client
      .from("user_media")
      .upsert({ user_id: owner.id, media_id: "movie_f24_int", status: "completed", score: 3 }, { onConflict: "user_id,media_id" });
    expect(error).toBeNull();
    expect(await row(owner)).toEqual({ score: 3, rating10: 6 });

    const rating10 = letterboxdToRating10("4.5")!;
    await owner.client
      .from("user_media")
      .update({ rating10, score: rating10ToScore(rating10) })
      .eq("user_id", owner.id)
      .eq("media_id", "movie_f24_int");
    expect(await row(owner)).toEqual({ score: 5, rating10: 9 });
  });

  it("registra un revisionado con fecha y reseña, que solo ve su dueño", async () => {
    const { error } = await owner.client.from("user_media_logs").insert({
      user_id: owner.id,
      media_id: "movie_f24_int",
      watched_on: "2026-10-20",
      rewatch: true,
      rating10: 9,
      review: "Mejor la segunda vez",
      spoiler: false,
    });
    expect(error).toBeNull();
    const mine = await owner.client.from("user_media_logs").select("watched_on, rewatch, review").eq("user_id", owner.id);
    expect(mine.data).toEqual([{ watched_on: "2026-10-20", rewatch: true, review: "Mejor la segunda vez" }]);
    const theirs = await other.client.from("user_media_logs").select("id").eq("user_id", owner.id);
    expect(theirs.data).toEqual([]);
  });

  it("la demo no escribe en el diario", async () => {
    await adminClient()
      .from("user_media")
      .upsert({ user_id: demo.id, media_id: "movie_f24_int", status: "completed" }, { onConflict: "user_id,media_id" });
    const { error } = await demo.client
      .from("user_media_logs")
      .insert({ user_id: demo.id, media_id: "movie_f24_int" });
    expect(error).not.toBeNull();
  });
});
