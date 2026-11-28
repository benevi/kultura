/**
 * Miembros de una lista: solo los leen su dueño y sus miembros (riesgo R1 de
 * Listas). Contra la base de TEST con
 * `20261231000007_list_members_select_members.sql` aplicada.
 * Uso: npm run test:integration -- tests/integration/rls
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { configured, adminClient, anonClient, createUser, deleteCreatedUsers, makeFriends, type TestUser } from "./helpers";

describe.skipIf(!configured)("RLS — list_members solo para dueño y miembros", () => {
  let owner: TestUser;
  let member: TestUser;
  let other: TestUser;
  let stranger: TestUser;
  let listId: string;

  beforeAll(async () => {
    owner = await createUser("lm-owner");
    member = await createUser("lm-member");
    other = await createUser("lm-other");
    stranger = await createUser("lm-stranger");
    await makeFriends(owner, member);
    await makeFriends(owner, other);
    const { data: list, error } = await owner.client
      .from("lists")
      .insert({ owner_id: owner.id, name: "Colaborativa pública", media_type: "movie", is_collaborative: true, is_public: true })
      .select("id")
      .single();
    if (error || !list) throw new Error(`lista: ${error?.message}`);
    listId = list.id;
    // El dueño invita a dos amigos.
    const inv = await owner.client.from("list_members").insert([
      { list_id: listId, user_id: member.id },
      { list_id: listId, user_id: other.id },
    ]);
    if (inv.error) throw new Error(`invitar: ${inv.error.message}`);
  }, 60_000);

  afterAll(deleteCreatedUsers, 60_000);

  const membersSeenBy = async (client: TestUser["client"]) => {
    const { data, error } = await client.from("list_members").select("user_id").eq("list_id", listId);
    expect(error).toBeNull();
    return (data ?? []).map((r) => r.user_id as string).sort();
  };

  it("el dueño y los miembros ven a todos los miembros", async () => {
    const all = [member.id, other.id].sort();
    expect(await membersSeenBy(owner.client)).toEqual(all);
    expect(await membersSeenBy(member.client)).toEqual(all);
  });

  it("quien no es dueño ni miembro no ve ninguno, aunque la lista sea pública y la pueda leer", async () => {
    const { data: list } = await stranger.client.from("lists").select("id").eq("id", listId).maybeSingle();
    expect(list?.id).toBe(listId);
    expect(await membersSeenBy(stranger.client)).toEqual([]);
  });

  it("sin sesión, ninguno", async () => {
    const { data } = await anonClient().from("list_members").select("user_id").eq("list_id", listId);
    expect(data ?? []).toEqual([]);
  });

  it("el dueño puede quitar a un miembro y un miembro puede salir", async () => {
    const leave = await member.client.from("list_members").delete().eq("list_id", listId).eq("user_id", member.id).select("user_id");
    expect(leave.error).toBeNull();
    expect(leave.data).toHaveLength(1);
    const kick = await owner.client.from("list_members").delete().eq("list_id", listId).eq("user_id", other.id).select("user_id");
    expect(kick.error).toBeNull();
    expect(kick.data).toHaveLength(1);
    const { data: left } = await adminClient().from("list_members").select("user_id").eq("list_id", listId);
    expect(left ?? []).toEqual([]);
  });
});
