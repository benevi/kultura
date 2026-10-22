/**
 * F-02 / ROJO-8 — Contra la base real: toda tabla pública tiene RLS, la que
 * admite escritura de authenticated tiene demo_no_insert/update/delete, y
 * ninguna política INSERT/UPDATE permisiva queda sin WITH CHECK
 * (public.rls_audit(), solo service_role). Y la cuenta demo no escribe.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { configured, adminClient, anonClient, createUser, deleteCreatedUsers, type TestUser } from "./helpers";

interface AuditRow {
  tabla: string;
  rls: boolean;
  escritura_authenticated: boolean;
  demo_insert: boolean;
  demo_update: boolean;
  demo_delete: boolean;
  politicas_sin_check: number;
  ok: boolean;
}

describe.skipIf(!configured)("RLS — auditoría de la base", () => {
  let demo: TestUser;
  let other: TestUser;

  beforeAll(async () => {
    demo = await createUser("demo", { demo: true });
    other = await createUser("no-demo");
  }, 60_000);

  afterAll(deleteCreatedUsers, 60_000);

  it("rls_audit(): ninguna tabla con problemas", async () => {
    const { data, error } = await adminClient().rpc("rls_audit");
    expect(error).toBeNull();
    const rows = (data ?? []) as AuditRow[];
    expect(rows.length).toBeGreaterThan(10);
    expect(rows.filter((r) => !r.ok)).toEqual([]);
  });

  it("rls_audit() no se puede llamar sin service_role", async () => {
    const { error } = await anonClient().rpc("rls_audit");
    expect(error).not.toBeNull();
    const { error: authErr } = await other.client.rpc("rls_audit");
    expect(authErr).not.toBeNull();
  });

  it("la cuenta demo no escribe su bio ni pide amistades", async () => {
    const bio = await demo.client.from("users").update({ bio: "demo" }).eq("id", demo.id).select("id");
    expect(bio.error !== null || (bio.data ?? []).length === 0).toBe(true);
    const fr = await demo.client
      .from("friendships")
      .insert({ requester_id: demo.id, receiver_id: other.id, status: "pending" })
      .select("id");
    expect(fr.error).not.toBeNull();
  });

  it("la cuenta demo sí puede leer", async () => {
    const { data, error } = await demo.client.from("users").select("id").eq("id", demo.id);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });
});
