// ============================================================
// KULTURA — discover_groups en SQL (saneamiento 6.4)
// Contra PostgREST real: recuento de miembros, filtros (q, scope, size),
// orden, página y que los grupos privados no salen.
// ============================================================

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { anonClient, configured, createUser, deleteCreatedUsers, type TestUser } from "../rls/helpers";

type Row = { id: string; member_count: number; is_member: boolean };

describe.skipIf(!configured)("groups: discover_groups (proyecto de test)", () => {
  // Prefijo único por ejecución: q lo usa para aislar estos grupos del resto.
  const tag = `Disc${Date.now().toString(36)}`;
  let ana: TestUser;
  let bea: TestUser;
  let carla: TestUser;
  let big: string; // público, 3 miembros
  let small: string; // público, 1 miembro, con «%_» en el nombre
  let hidden: string; // privado

  async function group(owner: TestUser, name: string, isPublic: boolean): Promise<string> {
    const id = crypto.randomUUID();
    const { error } = await owner.client.from("groups").insert({ id, owner_id: owner.id, name, is_public: isPublic });
    if (error) throw new Error(`group: ${error.message}`);
    return id;
  }

  async function join(u: TestUser, groupId: string): Promise<void> {
    const { error } = await u.client.from("group_members").insert({ group_id: groupId, user_id: u.id, role: "member" });
    if (error) throw new Error(`join: ${error.message}`);
  }

  async function discover(u: TestUser, args: Record<string, unknown> = {}): Promise<Row[]> {
    const { data, error } = await u.client.rpc("discover_groups", { p_q: tag, ...args });
    if (error) throw new Error(`discover: ${error.message}`);
    return data as Row[];
  }

  beforeAll(async () => {
    ana = await createUser("disc-ana");
    bea = await createUser("disc-bea");
    carla = await createUser("disc-carla");
    big = await group(ana, `${tag} grande`, true);
    small = await group(bea, `${tag} 100%_real`, true);
    hidden = await group(ana, `${tag} secreto`, false);
    await join(bea, big);
    await join(carla, big);
  });

  afterAll(async () => {
    await deleteCreatedUsers();
  });

  it("cuenta miembros, ordena por tamaño y no enseña privados", async () => {
    const rows = await discover(carla);
    expect(rows.map((r) => r.id)).toEqual([big, small]);
    expect(rows.map((r) => Number(r.member_count))).toEqual([3, 1]);
    expect(rows.map((r) => r.is_member)).toEqual([true, false]);
    expect(rows.some((r) => r.id === hidden)).toBe(false);
  });

  it("scope joined / unjoined desde quien llama", async () => {
    expect((await discover(bea, { p_scope: "joined" })).map((r) => r.id)).toEqual([big, small]);
    expect((await discover(carla, { p_scope: "joined" })).map((r) => r.id)).toEqual([big]);
    expect((await discover(carla, { p_scope: "unjoined" })).map((r) => r.id)).toEqual([small]);
  });

  it("size por número de miembros", async () => {
    expect((await discover(carla, { p_size: "small" })).map((r) => r.id)).toEqual([big, small]);
    expect(await discover(carla, { p_size: "medium" })).toEqual([]);
  });

  it("pagina con limit/offset en la base", async () => {
    expect((await discover(carla, { p_limit: 1, p_offset: 0 })).map((r) => r.id)).toEqual([big]);
    expect((await discover(carla, { p_limit: 1, p_offset: 1 })).map((r) => r.id)).toEqual([small]);
    expect(await discover(carla, { p_limit: 1, p_offset: 2 })).toEqual([]);
  });

  it("«%» y «_» se buscan literales, sin comodines", async () => {
    const { data, error } = await carla.client.rpc("discover_groups", { p_q: `${tag} 100%_` });
    expect(error).toBeNull();
    expect((data as Row[]).map((r) => r.id)).toEqual([small]);
    const none = await carla.client.rpc("discover_groups", { p_q: `${tag} 1_0` });
    expect(none.data).toEqual([]);
  });

  it("anon no puede llamarla", async () => {
    const { error } = await anonClient().rpc("discover_groups", { p_q: tag });
    expect(error).not.toBeNull();
  });
});
