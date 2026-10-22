/**
 * F-12 · Identidad, privacidad y borrado contra el proyecto Supabase de TEST
 * (con 20261101120001_identity_privacy.sql aplicada). Se salta sin las
 * variables SUPABASE_TEST_*.
 *
 * Cubre la aceptación del frente: nombre `u_<6>` aunque el email sea
 * `nombre.apellido@x`; tras renombrar, el antiguo redirige; con `private` otro
 * usuario con sesión lee 0 filas de user_media y con `friends` solo los
 * amigos; borrar al dueño de un grupo con 2 miembros deja dueño nuevo; la fila
 * nueva guarda terms_accepted_at; y la demo no cambia su contraseña (ROJO-8).
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  adminClient,
  configured,
  createGroup,
  createUser,
  deleteCreatedUsers,
  makeFriends,
  type TestUser,
} from "../rls/helpers";

const RUN = Date.now().toString(36);

describe.skipIf(!configured)("F-12 identidad (proyecto de test)", () => {
  let owner: TestUser;
  let friend: TestUser;
  let stranger: TestUser;

  beforeAll(async () => {
    owner = await createUser("f12-owner");
    friend = await createUser("f12-friend");
    stranger = await createUser("f12-stranger");
    await makeFriends(owner, friend);
    const admin = adminClient();
    await admin
      .from("media")
      .upsert({ id: "movie_f12_lib", external_id: "f12_lib", type: "movie", title: "F12" });
    const { error } = await owner.client
      .from("user_media")
      .upsert({ user_id: owner.id, media_id: "movie_f12_lib", status: "completed", score: 5 }, { onConflict: "user_id,media_id" });
    if (error) throw new Error(error.message);
  });

  afterAll(async () => {
    await deleteCreatedUsers();
  });

  it("el nombre generado no sale del email y la aceptación de términos se guarda", async () => {
    const admin = adminClient();
    const { data, error } = await admin.auth.admin.createUser({
      email: `nombre.apellido.${RUN}@kultura.test`,
      password: `F12-${RUN}-Aa1!`,
      email_confirm: true,
      user_metadata: { terms_accepted: true, terms_version: "2026-09" },
    });
    expect(error).toBeNull();
    const id = data.user!.id;
    try {
      const { data: profile } = await admin.from("users").select("username").eq("id", id).single();
      expect(profile!.username).toMatch(/^u_[a-z0-9]{6}$/);
      const { data: state } = await admin
        .from("account_state")
        .select("terms_accepted_at, terms_version, onboarded_at")
        .eq("user_id", id)
        .single();
      expect(state!.terms_accepted_at).not.toBeNull();
      expect(state!.terms_version).toBe("2026-09");
      expect(state!.onboarded_at).toBeNull();
    } finally {
      await admin.auth.admin.deleteUser(id);
    }
  });

  it("tras renombrar, el nombre antiguo resuelve al nuevo (308 en /u y /profile)", async () => {
    const admin = adminClient();
    const { data: before } = await admin.from("users").select("username").eq("id", owner.id).single();
    const renamed = `f12_${RUN}`.slice(0, 20);
    await admin.from("users").update({ username: renamed }).eq("id", owner.id);
    const { data } = await stranger.client.rpc("username_redirect", { p_username: before!.username });
    expect(data).toBe(renamed);
  });

  it("friends (por defecto): el amigo la ve, un desconocido no", async () => {
    const { data: byFriend } = await friend.client.from("user_media").select("media_id").eq("user_id", owner.id);
    const { data: byStranger } = await stranger.client.from("user_media").select("media_id").eq("user_id", owner.id);
    expect(byFriend).toHaveLength(1);
    expect(byStranger).toHaveLength(0);
  });

  it("private: nadie más la ve, ni el amigo", async () => {
    const { error } = await owner.client.from("users").update({ library_visibility: "private" }).eq("id", owner.id);
    expect(error).toBeNull();
    const { data } = await friend.client.from("user_media").select("media_id").eq("user_id", owner.id);
    expect(data).toHaveLength(0);
    const { data: own } = await owner.client.from("user_media").select("media_id").eq("user_id", owner.id);
    expect(own).toHaveLength(1);
  });

  it("account_state: solo el servidor la escribe", async () => {
    const { data } = await owner.client
      .from("account_state")
      .update({ onboarded_at: new Date().toISOString() })
      .eq("user_id", owner.id)
      .select();
    expect(data ?? []).toHaveLength(0);
  });

  it("borrar al dueño de un grupo con 2 miembros deja el grupo con dueño nuevo", async () => {
    const groupOwner = await createUser("f12-gowner");
    const member = await createUser("f12-gmember");
    await makeFriends(groupOwner, member);
    const groupId = await createGroup(groupOwner, true);
    const admin = adminClient();
    await admin.from("group_members").insert({ group_id: groupId, user_id: member.id, role: "member" });

    const { error } = await admin.rpc("transfer_owned_content", { p_user: groupOwner.id });
    expect(error).toBeNull();
    await admin.auth.admin.deleteUser(groupOwner.id);

    const { data: group } = await admin.from("groups").select("owner_id").eq("id", groupId).single();
    expect(group!.owner_id).toBe(member.id);
  });

  it("ROJO-8: la demo no puede cambiar su contraseña por la API de Auth", async () => {
    const demo = await createUser("f12-demo", { demo: true });
    const { error } = await demo.client.auth.updateUser({ password: `Otra-${RUN}-Aa1!` });
    expect(error).not.toBeNull();
  });
});
