/**
 * F-02 — Cada ataque por PostgREST directo (saltándose la API) tiene que ser
 * rechazado por la base. Requiere aplicada `20261023020001_harden_rls.sql` en
 * el proyecto de TEST. Uso: npm run test:integration -- tests/integration/rls
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  configured,
  adminClient,
  anonClient,
  createUser,
  deleteCreatedUsers,
  makeFriends,
  createGroup,
  isMember,
  blocked,
  type TestUser,
} from "./helpers";

describe.skipIf(!configured)("RLS — ataques rechazados", () => {
  let attacker: TestUser;
  let victim: TestUser;
  let friend: TestUser;
  let victimGroup: string;
  let attackerGroup: string;

  beforeAll(async () => {
    attacker = await createUser("atacante");
    victim = await createUser("victima");
    friend = await createUser("amigo");
    await makeFriends(attacker, friend);
    victimGroup = await createGroup(victim, false);
    attackerGroup = await createGroup(attacker, true);
  }, 60_000);

  afterAll(deleteCreatedUsers, 60_000);

  it("no se crea una amistad 'accepted' con un solo INSERT", async () => {
    const res = await attacker.client
      .from("friendships")
      .insert({ requester_id: attacker.id, receiver_id: victim.id, status: "accepted" })
      .select("id");
    expect(blocked(res)).toBe(true);
  });

  it("no se crea una amistad consigo mismo", async () => {
    const res = await attacker.client
      .from("friendships")
      .insert({ requester_id: attacker.id, receiver_id: attacker.id, status: "pending" })
      .select("id");
    expect(blocked(res)).toBe(true);
  });

  it("el receptor no puede cambiar requester_id al aceptar", async () => {
    const { data: req } = await friend.client
      .from("friendships")
      .insert({ requester_id: friend.id, receiver_id: victim.id, status: "pending" })
      .select("id")
      .single();
    // La víctima (receptora) intenta reescribir quién pidió la amistad.
    const res = await victim.client
      .from("friendships")
      .update({ requester_id: attacker.id, status: "accepted" })
      .eq("id", req!.id)
      .select("id");
    expect(blocked(res)).toBe(true);
    await adminClient().from("friendships").delete().eq("id", req!.id);
  });

  it("no se entra en un grupo privado cambiando el group_id de una invitación", async () => {
    const { data: inv, error } = await attacker.client
      .from("group_invitations")
      .insert({ group_id: attackerGroup, inviter_id: attacker.id, invitee_id: friend.id })
      .select("id")
      .single();
    expect(error).toBeNull();
    const res = await friend.client
      .from("group_invitations")
      .update({ group_id: victimGroup, status: "accepted" })
      .eq("id", inv!.id)
      .select("id");
    expect(blocked(res)).toBe(true);
    expect(await isMember(victimGroup, friend.id)).toBe(false);
    await adminClient().from("group_invitations").delete().eq("id", inv!.id);
  });

  it("no se puede invitar uno a sí mismo", async () => {
    const res = await attacker.client
      .from("group_invitations")
      .insert({ group_id: attackerGroup, inviter_id: attacker.id, invitee_id: attacker.id })
      .select("id");
    expect(blocked(res)).toBe(true);
  });

  it("quien sale de un grupo no puede volver re-aceptando su invitación vieja", async () => {
    // La víctima invita a `friend` (se hacen amigos para el montaje).
    await makeFriends(victim, friend);
    const { data: inv } = await victim.client
      .from("group_invitations")
      .insert({ group_id: victimGroup, inviter_id: victim.id, invitee_id: friend.id })
      .select("id")
      .single();
    const { error: acceptErr } = await friend.client
      .from("group_invitations")
      .update({ status: "accepted" })
      .eq("id", inv!.id);
    expect(acceptErr).toBeNull();
    expect(await isMember(victimGroup, friend.id)).toBe(true);

    await friend.client.from("group_members").delete().eq("group_id", victimGroup).eq("user_id", friend.id);
    expect(await isMember(victimGroup, friend.id)).toBe(false);

    await friend.client.from("group_invitations").update({ status: "pending" }).eq("id", inv!.id);
    await friend.client.from("group_invitations").update({ status: "accepted" }).eq("id", inv!.id);
    expect(await isMember(victimGroup, friend.id)).toBe(false);
  });

  it("sin sesión no se lee ninguna biblioteca (GET user_media = [])", async () => {
    const { data, error } = await anonClient().from("user_media").select("user_id").limit(5);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it.each(["created_at", "preferred_locale", "*"])(
    "sin sesión, la columna no pública %s de users da error",
    async (column) => {
      const { error } = await anonClient().from("users").select(column).limit(1);
      expect(error).not.toBeNull();
    },
  );

  it("no se entra en una conversación ajena insertándose como miembro", async () => {
    await makeFriends(victim, attacker);
    const { data: conv } = await victim.client.rpc("create_conversation_with_members", {
      target_user_id: attacker.id,
    });
    // `friend` no es miembro: intenta colarse.
    const res = await friend.client
      .from("conversation_members")
      .insert({ conversation_id: conv as string, user_id: friend.id })
      .select("user_id");
    expect(blocked(res)).toBe(true);
  });

  it("no se mueve la fila propia de conversation_members a otra conversación", async () => {
    const { data: own } = await attacker.client.rpc("create_conversation_with_members", {
      target_user_id: friend.id,
    });
    const { data: foreign } = await victim.client.rpc("create_conversation_with_members", {
      target_user_id: attacker.id,
    });
    expect(own).toBeTruthy();
    // `friend` mueve su fila de su chat con `attacker` al de victim↔attacker.
    const res = await friend.client
      .from("conversation_members")
      .update({ conversation_id: foreign as string })
      .eq("conversation_id", own as string)
      .eq("user_id", friend.id)
      .select("user_id");
    expect(blocked(res)).toBe(true);
  });

  it("una bio de 5.000 caracteres se rechaza en la base", async () => {
    const res = await attacker.client
      .from("users")
      .update({ bio: "x".repeat(5000) })
      .eq("id", attacker.id)
      .select("id");
    expect(blocked(res)).toBe(true);
  });

  it("el nombre de usuario no se cambia con el JWT (solo por /api/settings)", async () => {
    const res = await attacker.client
      .from("users")
      .update({ username: `admin_${Date.now() % 100000}` })
      .eq("id", attacker.id)
      .select("id");
    expect(blocked(res)).toBe(true);
  });

  it("el dueño no puede meter en su lista a alguien que no es su amigo", async () => {
    const { data: list } = await attacker.client
      .from("lists")
      .insert({ owner_id: attacker.id, name: "F02", media_type: "movie", is_collaborative: true })
      .select("id")
      .single();
    // `victim` ya es amiga de attacker en este punto; creamos a un desconocido.
    const stranger = await createUser("desconocido");
    const res = await attacker.client
      .from("list_members")
      .insert({ list_id: list!.id, user_id: stranger.id })
      .select("user_id");
    expect(blocked(res)).toBe(true);
  });

  it("el dueño no puede meter en su grupo a alguien que no es su amigo, ni a un amigo como owner", async () => {
    const stranger = await createUser("desconocido2");
    const r1 = await attacker.client
      .from("group_members")
      .insert({ group_id: attackerGroup, user_id: stranger.id, role: "member" })
      .select("user_id");
    expect(blocked(r1)).toBe(true);
    const r2 = await attacker.client
      .from("group_members")
      .insert({ group_id: attackerGroup, user_id: friend.id, role: "owner" })
      .select("user_id");
    expect(blocked(r2)).toBe(true);
  });

  it("el dueño no puede invitar a su grupo a quien no es su amigo", async () => {
    const stranger = await createUser("desconocido3");
    const res = await attacker.client
      .from("group_invitations")
      .insert({ group_id: attackerGroup, inviter_id: attacker.id, invitee_id: stranger.id })
      .select("id");
    expect(blocked(res)).toBe(true);
  });

  it("el receptor de una recomendación no reescribe el mensaje", async () => {
    const admin = adminClient();
    await admin.from("media").upsert({ id: "movie_f02_rls", external_id: "f02_rls", type: "movie", title: "F02" });
    const { data: rec } = await admin
      .from("recommendations")
      .insert({ from_user_id: friend.id, to_user_id: attacker.id, media_id: "movie_f02_rls", message: "hola" })
      .select("id")
      .single();
    const res = await attacker.client
      .from("recommendations")
      .update({ message: "spam" })
      .eq("id", rec!.id)
      .select("id");
    expect(blocked(res)).toBe(true);
  });

  it("sin sesión no se ejecutan los oráculos de pertenencia", async () => {
    const anon = anonClient();
    const r1 = await anon.rpc("is_group_member", { group_id: victimGroup, uid: victim.id });
    const r2 = await anon.rpc("is_group_owner", { p_group_id: victimGroup, p_uid: victim.id });
    expect(r1.error).not.toBeNull();
    expect(r2.error).not.toBeNull();
  });

  it("posts de grupo y mensajes de 5.000 caracteres se rechazan", async () => {
    const post = await attacker.client
      .from("group_posts")
      .insert({ group_id: attackerGroup, user_id: attacker.id, content: "x".repeat(5000) })
      .select("id");
    expect(blocked(post)).toBe(true);
    const { data: conv } = await attacker.client.rpc("create_conversation_with_members", {
      target_user_id: friend.id,
    });
    const msg = await attacker.client
      .from("messages")
      .insert({ conversation_id: conv as string, sender_id: attacker.id, content: "x".repeat(5000) })
      .select("id");
    expect(blocked(msg)).toBe(true);
  });
});
