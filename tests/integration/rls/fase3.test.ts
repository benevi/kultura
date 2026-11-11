/**
 * Saneamiento fase 3 — contra la base de TEST con
 * `20261231000001_integrity_and_indexes.sql` aplicada.
 * Uso: npm run test:integration -- tests/integration/rls
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { configured, adminClient, createUser, deleteCreatedUsers, makeFriends, type TestUser } from "./helpers";

const MEDIA = "movie_fase3_rls";

describe.skipIf(!configured)("Integridad — saneamiento fase 3", () => {
  let a: TestUser;
  let b: TestUser;
  let c: TestUser;

  beforeAll(async () => {
    a = await createUser("f3-a");
    b = await createUser("f3-b");
    c = await createUser("f3-c");
    await makeFriends(a, b);
    await adminClient().from("media").upsert({ id: MEDIA, external_id: "fase3_rls", type: "movie", title: "Fase 3" });
  }, 60_000);

  afterAll(deleteCreatedUsers, 60_000);

  it("una sola amistad por pareja, en cualquier sentido", async () => {
    const res = await adminClient()
      .from("friendships")
      .insert({ requester_id: b.id, receiver_id: a.id, status: "pending" });
    expect(res.error?.code).toBe("23505");
  });

  it("un título una sola vez por lista", async () => {
    const { data: list } = await a.client
      .from("lists")
      .insert({ owner_id: a.id, name: "Fase 3", media_type: "movie" })
      .select("id")
      .single();
    const first = await a.client.from("list_items").insert({ list_id: list!.id, media_id: MEDIA, added_by: a.id });
    expect(first.error).toBeNull();
    const second = await a.client.from("list_items").insert({ list_id: list!.id, media_id: MEDIA, added_by: a.id });
    expect(second.error?.code).toBe("23505");
  });

  it("una sola conversación por pareja, aunque se pida a la vez desde los dos lados", async () => {
    await makeFriends(a, c);
    const results = await Promise.all([
      a.client.rpc("create_conversation_with_members", { target_user_id: c.id }),
      c.client.rpc("create_conversation_with_members", { target_user_id: a.id }),
      a.client.rpc("create_conversation_with_members", { target_user_id: c.id }),
    ]);
    for (const r of results) expect(r.error).toBeNull();
    const ids = new Set(results.map((r) => r.data as string));
    expect(ids.size).toBe(1);

    const [id] = [...ids];
    const { data: conv } = await adminClient().from("conversations").select("user_low, user_high").eq("id", id).single();
    expect([conv!.user_low, conv!.user_high]).toEqual([a.id, c.id].sort());
    const { data: members } = await adminClient().from("conversation_members").select("user_id").eq("conversation_id", id);
    expect(members).toHaveLength(2);
  });

  it("borrar una ficha borra sus entradas de biblioteca (cascada)", async () => {
    const admin = adminClient();
    const id = "movie_fase3_cascade";
    await admin.from("media").upsert({ id, external_id: "fase3_cascade", type: "movie", title: "Cascada" });
    const up = await b.client.from("user_media").insert({ user_id: b.id, media_id: id, status: "pending" });
    expect(up.error).toBeNull();
    const del = await admin.from("media").delete().eq("id", id);
    expect(del.error).toBeNull();
    const { data } = await admin.from("user_media").select("id").eq("media_id", id);
    expect(data).toEqual([]);
  });
});
