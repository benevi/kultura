/**
 * F-11 — Moderación contra la base real (proyecto de TEST, nunca producción).
 * Requiere aplicadas las de W1 y `20261101110001_moderation.sql`.
 * Uso: npm run test:integration -- tests/integration/moderation
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  configured,
  adminClient,
  anonClient,
  createUser,
  deleteCreatedUsers,
  makeFriends,
  isMember,
  blocked,
  type TestUser,
} from "../rls/helpers";

/** Grupo creado por el servidor: el disparador mete al dueño como 'owner'. */
async function serverGroup(owner: TestUser, isPublic: boolean): Promise<string> {
  const id = crypto.randomUUID();
  const { error } = await adminClient()
    .from("groups")
    .insert({ id, owner_id: owner.id, name: `F11 ${id.slice(0, 6)}`, is_public: isPublic });
  if (error) throw new Error(`serverGroup: ${error.message}`);
  return id;
}

async function openChat(a: TestUser, b: TestUser): Promise<string> {
  const { data, error } = await a.client.rpc("create_conversation_with_members", { target_user_id: b.id });
  if (error || !data) throw new Error(`openChat: ${error?.message}`);
  return data as string;
}

async function send(u: TestUser, conversationId: string, content = "hola") {
  return u.client.from("messages").insert({ conversation_id: conversationId, sender_id: u.id, content });
}

describe.skipIf(!configured)("Moderación (F-11)", () => {
  let ana: TestUser;
  let bea: TestUser;
  let carla: TestUser;
  let dani: TestUser;

  beforeAll(async () => {
    ana = await createUser("f11-ana");
    bea = await createUser("f11-bea");
    carla = await createUser("f11-carla");
    dani = await createUser("f11-dani");
    await makeFriends(ana, bea);
    await makeFriends(ana, carla);
    await makeFriends(ana, dani);
  }, 60_000);

  afterAll(deleteCreatedUsers, 60_000);

  it("con amistad y sin bloqueo se escribe; tras BLOQUEAR, el INSERT del otro falla", async () => {
    const conv = await openChat(ana, bea);
    expect((await send(bea, conv)).error).toBeNull();

    expect((await ana.client.from("blocks").insert({ blocker_id: ana.id, blocked_id: bea.id })).error).toBeNull();
    expect((await send(bea, conv)).error).not.toBeNull();
    expect((await send(ana, conv)).error).not.toBeNull();

    // Bloquear borró la amistad, y el bloqueado no puede volver a pedirla.
    const { data: f } = await adminClient()
      .from("friendships")
      .select("id")
      .or(`and(requester_id.eq.${ana.id},receiver_id.eq.${bea.id}),and(requester_id.eq.${bea.id},receiver_id.eq.${ana.id})`);
    expect(f).toEqual([]);
    const again = await bea.client
      .from("friendships")
      .insert({ requester_id: bea.id, receiver_id: ana.id, status: "pending" });
    expect(again.error).not.toBeNull();

    // El bloqueado no ve la fila del bloqueo.
    const { data: seen } = await bea.client.from("blocks").select("blocker_id");
    expect(seen).toEqual([]);
  });

  it("tras DEJAR DE SER AMIGOS, el INSERT de messages del otro falla", async () => {
    const conv = await openChat(ana, carla);
    expect((await send(carla, conv)).error).toBeNull();
    await ana.client
      .from("friendships")
      .delete()
      .or(`and(requester_id.eq.${ana.id},receiver_id.eq.${carla.id}),and(requester_id.eq.${carla.id},receiver_id.eq.${ana.id})`);
    expect((await send(carla, conv)).error).not.toBeNull();
  });

  it("salir elimina la pertenencia (y el que sale ya no lee la conversación)", async () => {
    const conv = await openChat(ana, dani);
    await send(dani, conv, "antes de salir");
    const res = await dani.client
      .from("conversation_members")
      .delete()
      .eq("conversation_id", conv)
      .eq("user_id", dani.id)
      .select("user_id");
    expect(blocked(res)).toBe(false);
    const { data: rows } = await adminClient()
      .from("conversation_members")
      .select("user_id")
      .eq("conversation_id", conv)
      .eq("user_id", dani.id);
    expect(rows).toEqual([]);
    const { data: msgs } = await dani.client.from("messages").select("id").eq("conversation_id", conv);
    expect(msgs).toEqual([]);
    // Y no puede sacar a otro de una conversación.
    const other = await dani.client.from("conversation_members").delete().eq("conversation_id", conv).eq("user_id", ana.id).select("user_id");
    expect(blocked(other)).toBe(true);
  });

  it("el dueño borra un post ajeno y expulsa; un no-dueño no puede; nadie se expulsa a sí mismo", async () => {
    const group = await serverGroup(ana, true);
    expect((await dani.client.from("group_members").insert({ group_id: group, user_id: dani.id, role: "member" })).error).toBeNull();
    expect((await carla.client.from("group_members").insert({ group_id: group, user_id: carla.id, role: "member" })).error).toBeNull();

    const { data: post } = await adminClient()
      .from("group_posts")
      .insert({ group_id: group, user_id: dani.id, content: "spam" })
      .select("id")
      .single();

    // Carla (miembro, no dueña) no borra el post de Dani ni le expulsa.
    expect(blocked(await carla.client.from("group_posts").delete().eq("id", post!.id).select("id"))).toBe(true);
    expect(blocked(await carla.client.from("group_members").delete().eq("group_id", group).eq("user_id", dani.id).select("user_id"))).toBe(true);

    // Ana (dueña) sí.
    expect(blocked(await ana.client.from("group_posts").delete().eq("id", post!.id).select("id"))).toBe(false);
    expect((await ana.client.from("group_bans").insert({ group_id: group, user_id: dani.id, banned_by: ana.id })).error).toBeNull();
    expect(await isMember(group, dani.id)).toBe(false);

    // Vetado: no vuelve a entrar solo en el grupo público.
    expect((await dani.client.from("group_members").insert({ group_id: group, user_id: dani.id, role: "member" })).error).not.toBeNull();

    // La dueña no se expulsa a sí misma.
    expect(blocked(await ana.client.from("group_members").delete().eq("group_id", group).eq("user_id", ana.id).select("user_id"))).toBe(true);
  });

  it("anon no lee reports; con sesión solo las propias; sin cuenta inserta el servidor con resolved_at nulo", async () => {
    const id = crypto.randomUUID();
    const { error } = await adminClient().from("reports").insert({
      id,
      reporter_id: null,
      contact_email: "vecina@example.com",
      target_type: "list",
      target_id: crypto.randomUUID(),
      reason: "spam: prueba F-11",
    });
    expect(error).toBeNull();

    const { data: anonRows } = await anonClient().from("reports").select("id");
    expect(anonRows ?? []).toEqual([]);
    expect((await anonClient().from("reports").insert({ target_type: "user", target_id: ana.id, contact_email: "x@y.z" })).error).not.toBeNull();

    const { data: row } = await adminClient().from("reports").select("resolved_at, resolution").eq("id", id).single();
    expect(row).toEqual({ resolved_at: null, resolution: null });

    // Con sesión: puede denunciar (sin RETURNING) y ve solo lo suyo.
    const mine = crypto.randomUUID();
    expect((await ana.client.from("reports").insert({ id: mine, reporter_id: ana.id, target_type: "message", target_id: crypto.randomUUID(), reason: "harassment" })).error).toBeNull();
    const { data: visible } = await ana.client.from("reports").select("id");
    expect((visible ?? []).map((r) => r.id)).toEqual([mine]);
    // No puede marcarse como resuelta ni denunciar en nombre de otro.
    expect((await ana.client.from("reports").insert({ reporter_id: bea.id, target_type: "user", target_id: carla.id })).error).not.toBeNull();
    expect((await ana.client.from("reports").insert({ reporter_id: ana.id, target_type: "user", target_id: carla.id, resolved_at: new Date().toISOString() })).error).not.toBeNull();
  });

  it("un grupo PRIVADO se crea con el JWT sin RETURNING y el dueño lo lee después", async () => {
    const id = crypto.randomUUID();
    expect((await ana.client.from("groups").insert({ id, owner_id: ana.id, name: "F11 privado", is_public: false })).error).toBeNull();
    const { data } = await ana.client.from("groups").select("id, is_public").eq("id", id).single();
    expect(data).toEqual({ id, is_public: false });
  });
});
