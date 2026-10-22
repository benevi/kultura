/**
 * F-02 — Lo que la app hace de verdad sigue funcionando con la RLS endurecida:
 * pedir y aceptar amistad, invitar y aceptar en un grupo, crear chat y marcarlo
 * leído, cambiar bio/avatar y (con admin) el nombre de usuario, listas con
 * amigos, notificaciones y biblioteca.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  configured,
  adminClient,
  anonClient,
  createUser,
  deleteCreatedUsers,
  createGroup,
  isMember,
  type TestUser,
} from "./helpers";

describe.skipIf(!configured)("RLS — caminos felices", () => {
  let a: TestUser;
  let b: TestUser;

  beforeAll(async () => {
    a = await createUser("feliz-a");
    b = await createUser("feliz-b");
  }, 60_000);

  afterAll(deleteCreatedUsers, 60_000);

  it("pedir amistad (pending) y aceptarla el receptor", async () => {
    const { data: req, error } = await a.client
      .from("friendships")
      .insert({ requester_id: a.id, receiver_id: b.id, status: "pending" })
      .select("id, status")
      .single();
    expect(error).toBeNull();
    expect(req!.status).toBe("pending");

    const { data: acc, error: accErr } = await b.client
      .from("friendships")
      .update({ status: "accepted" })
      .eq("id", req!.id)
      .select("id, requester_id, receiver_id, status, created_at")
      .single();
    expect(accErr).toBeNull();
    expect(acc!.status).toBe("accepted");
  });

  it("crear chat con un amigo, escribir y marcarlo leído", async () => {
    const { data: conv, error } = await a.client.rpc("create_conversation_with_members", {
      target_user_id: b.id,
    });
    expect(error).toBeNull();
    const { error: msgErr } = await a.client
      .from("messages")
      .insert({ conversation_id: conv as string, sender_id: a.id, content: "hola" });
    expect(msgErr).toBeNull();
    const { data: read, error: readErr } = await b.client
      .from("conversation_members")
      .update({ last_read_at: new Date().toISOString() })
      .eq("conversation_id", conv as string)
      .eq("user_id", b.id)
      .select("user_id");
    expect(readErr).toBeNull();
    expect(read).toHaveLength(1);
  });

  it("invitar a un amigo a un grupo privado y que la acepte", async () => {
    const group = await createGroup(a, false);
    const { data: inv, error } = await a.client
      .from("group_invitations")
      .insert({ group_id: group, inviter_id: a.id, invitee_id: b.id })
      .select("id")
      .single();
    expect(error).toBeNull();
    const { error: accErr, count } = await b.client
      .from("group_invitations")
      .update({ status: "accepted" }, { count: "exact" })
      .eq("id", inv!.id)
      .eq("status", "pending");
    expect(accErr).toBeNull();
    expect(count).toBe(1);
    expect(await isMember(group, b.id)).toBe(true);
  });

  it("cambiar bio, color, personaje e idioma con el JWT", async () => {
    const { data, error } = await a.client
      .from("users")
      .update({ bio: "Hola", avatar_color: "teal", avatar_icon: "robot", preferred_locale: "en" })
      .eq("id", a.id)
      .select("*")
      .single();
    expect(error).toBeNull();
    expect(data!.bio).toBe("Hola");
  });

  it("cambiar el nombre de usuario con el cliente admin (lo que hace /api/settings)", async () => {
    const username = `f02_${Date.now() % 1_000_000}`;
    const { error } = await adminClient().from("users").update({ username }).eq("id", a.id);
    expect(error).toBeNull();
    // Y /u lo puede leer sin sesión con las columnas públicas.
    const { data, error: anonErr } = await anonClient()
      .from("users")
      .select("id, username, avatar_color, avatar_initials, avatar_icon, bio")
      .eq("username", username)
      .maybeSingle();
    expect(anonErr).toBeNull();
    expect(data?.id).toBe(a.id);
  });

  it("añadir a un amigo a una lista colaborativa y que añada un título", async () => {
    await adminClient()
      .from("media")
      .upsert({ id: "movie_f02_happy", external_id: "f02_happy", type: "movie", title: "F02" });
    const { data: list } = await a.client
      .from("lists")
      .insert({ owner_id: a.id, name: "F02", media_type: "movie", is_collaborative: true })
      .select("id")
      .single();
    const { error } = await a.client
      .from("list_members")
      .upsert({ list_id: list!.id, user_id: b.id }, { onConflict: "list_id,user_id", ignoreDuplicates: true });
    expect(error).toBeNull();
    const { error: itemErr } = await b.client
      .from("list_items")
      .insert({ list_id: list!.id, media_id: "movie_f02_happy", added_by: b.id });
    expect(itemErr).toBeNull();
    const { error: pubErr } = await a.client.from("lists").update({ is_public: true }).eq("id", list!.id);
    expect(pubErr).toBeNull();
  });

  it("biblioteca: upsert propio y otro usuario con sesión la ve", async () => {
    await adminClient()
      .from("media")
      .upsert({ id: "movie_f02_happy", external_id: "f02_happy", type: "movie", title: "F02" });
    const { error } = await a.client
      .from("user_media")
      .upsert({ user_id: a.id, media_id: "movie_f02_happy", status: "completed", score: 4 }, { onConflict: "user_id,media_id" });
    expect(error).toBeNull();
    const { data } = await b.client.from("user_media").select("media_id").eq("user_id", a.id);
    expect(data).toHaveLength(1);
  });

  it("notificaciones: marcar leída y borrar la propia", async () => {
    const admin = adminClient();
    const { data: n } = await admin
      .from("notifications")
      .insert({ user_id: a.id, type: "recommendation", payload: {} })
      .select("id")
      .single();
    const { error: readErr } = await a.client
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", n!.id);
    expect(readErr).toBeNull();
    const { data: del, error: delErr } = await a.client
      .from("notifications")
      .delete()
      .eq("id", n!.id)
      .select("id");
    expect(delErr).toBeNull();
    expect(del).toHaveLength(1);
  });

  it("unirse a un grupo público y salir", async () => {
    const group = await createGroup(b, true);
    const { error } = await a.client
      .from("group_members")
      .insert({ group_id: group, user_id: a.id, role: "member" });
    expect(error).toBeNull();
    const { error: leaveErr } = await a.client
      .from("group_members")
      .delete()
      .eq("group_id", group)
      .eq("user_id", a.id);
    expect(leaveErr).toBeNull();
    expect(await isMember(group, a.id)).toBe(false);
  });

  it("dueño de un grupo nuevo queda como owner (disparador sin EXECUTE para el usuario)", async () => {
    const group = await createGroup(a, true);
    const { data } = await adminClient()
      .from("group_members")
      .select("role")
      .eq("group_id", group)
      .eq("user_id", a.id)
      .single();
    expect(data!.role).toBe("owner");
  });
});
