/**
 * Saneamiento fase 2 — contra la base de TEST con
 * `20261230000001_harden_grants_and_policies.sql` aplicada.
 * Uso: npm run test:integration -- tests/integration/rls
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

const MEDIA = "movie_fase2_rls";

describe.skipIf(!configured)("RLS — saneamiento fase 2", () => {
  let a: TestUser;
  let b: TestUser; // amiga de a
  let stranger: TestUser;
  let groupA: string;

  beforeAll(async () => {
    a = await createUser("f2-a");
    b = await createUser("f2-b");
    stranger = await createUser("f2-desconocido");
    await makeFriends(a, b);
    groupA = await createGroup(a, false);
    await adminClient().from("media").upsert({ id: MEDIA, external_id: "fase2_rls", type: "movie", title: "Fase 2" });
  }, 60_000);

  afterAll(deleteCreatedUsers, 60_000);

  // Desde el saneamiento 12.2 viven en el esquema `private`: ya no se llaman
  // por la API ni sobre uno mismo (solo las usan las políticas).
  it("2. is_group_member / is_conversation_member no responden sobre otra persona", async () => {
    const other = await b.client.rpc("is_group_member" as never, { group_id: groupA, uid: a.id } as never);
    expect(other.error?.code).toBe("PGRST202");
    const self = await a.client.rpc("is_group_member" as never, { group_id: groupA, uid: a.id } as never);
    expect(self.error?.code).toBe("PGRST202");

    const { data: conv } = await a.client.rpc("create_conversation_with_members", { target_user_id: b.id });
    const chatOther = await stranger.client.rpc(
      "is_conversation_member" as never,
      { conv_id: conv as string, uid: a.id } as never,
    );
    expect(chatOther.error?.code).toBe("PGRST202");
  });

  it("3. username_redirect ya no existe (Q8)", async () => {
    const res = await anonClient().rpc("username_redirect", { p_username: "x" });
    expect(res.error).not.toBeNull();
  });

  it("4. solo se recomienda a amistades aceptadas (Q7)", async () => {
    const toStranger = await a.client
      .from("recommendations")
      .insert({ from_user_id: a.id, to_user_id: stranger.id, media_id: MEDIA })
      .select("id");
    expect(blocked(toStranger)).toBe(true);
    expect((toStranger.error as { code?: string } | null)?.code).toBe("42501");

    const toFriend = await a.client
      .from("recommendations")
      .insert({ from_user_id: a.id, to_user_id: b.id, media_id: MEDIA })
      .select("id");
    expect(toFriend.error).toBeNull();
  });

  it("5. el dueño no mete a un amigo en su grupo sin invitación (Q10)", async () => {
    const res = await a.client
      .from("group_members")
      .insert({ group_id: groupA, user_id: b.id, role: "member" })
      .select("user_id");
    expect(blocked(res)).toBe(true);
    expect(await isMember(groupA, b.id)).toBe(false);
  });

  it("6. un miembro no añade títulos a una lista que no es colaborativa", async () => {
    const { data: list } = await a.client
      .from("lists")
      .insert({ owner_id: a.id, name: "Fase 2", media_type: "movie", is_collaborative: false })
      .select("id")
      .single();
    // Miembro de antes (cuando era colaborativa): lo monta el servidor.
    await adminClient().from("list_members").insert({ list_id: list!.id, user_id: b.id });
    const res = await b.client
      .from("list_items")
      .insert({ list_id: list!.id, media_id: MEDIA, added_by: b.id })
      .select("id");
    expect(blocked(res)).toBe(true);
    const own = await a.client.from("list_items").insert({ list_id: list!.id, media_id: MEDIA, added_by: a.id });
    expect(own.error).toBeNull();
  });

  it("7. no se crea una conversación con INSERT directo", async () => {
    const res = await a.client.from("conversations").insert({}).select("id");
    expect(blocked(res)).toBe(true);
  });

  it("9. la fecha del mensaje la pone el servidor", async () => {
    const { data: conv } = await a.client.rpc("create_conversation_with_members", { target_user_id: b.id });
    const { data: msg, error } = await a.client
      .from("messages")
      .insert({ conversation_id: conv as string, sender_id: a.id, content: "hola", created_at: "2000-01-01T00:00:00Z" })
      .select("created_at")
      .single();
    expect(error).toBeNull();
    expect(Date.now() - Date.parse(msg!.created_at as string)).toBeLessThan(5 * 60_000);
  });

  it("11. la biblioteca se sigue actualizando (set_updated_at sin EXECUTE)", async () => {
    const up = await a.client
      .from("user_media")
      .upsert({ user_id: a.id, media_id: MEDIA, status: "in_progress" }, { onConflict: "user_id,media_id" });
    expect(up.error).toBeNull();
    const { data, error } = await a.client
      .from("user_media")
      .update({ status: "completed" })
      .eq("user_id", a.id)
      .eq("media_id", MEDIA)
      .select("status");
    expect(error).toBeNull();
    expect(data).toEqual([{ status: "completed" }]);
  });

  it("10. borrar una cuenta deja sus mensajes sin autor y vacíos en el chat del otro (Q6)", async () => {
    const leaving = await createUser("f2-se-va");
    await makeFriends(leaving, b);
    const { data: conv } = await leaving.client.rpc("create_conversation_with_members", { target_user_id: b.id });
    const { data: msg } = await leaving.client
      .from("messages")
      .insert({ conversation_id: conv as string, sender_id: leaving.id, content: "adiós" })
      .select("id")
      .single();

    const { error } = await adminClient().auth.admin.deleteUser(leaving.id);
    expect(error).toBeNull();

    const { data: rows } = await b.client.from("messages").select("sender_id, content").eq("id", msg!.id);
    expect(rows).toEqual([{ sender_id: null, content: "" }]);
  });
});
