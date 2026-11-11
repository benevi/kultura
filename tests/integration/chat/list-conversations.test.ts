// ============================================================
// KULTURA — listConversations en una sola consulta (saneamiento 6.4)
// Comprueba contra PostgREST real que los embeds con límite por
// conversación devuelven el otro miembro y el ÚLTIMO mensaje.
// ============================================================

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { listConversations } from "@/lib/chat/service";
import { configured, createUser, deleteCreatedUsers, makeFriends, type TestUser } from "../rls/helpers";

describe.skipIf(!configured)("chat: lista de conversaciones (proyecto de test)", () => {
  let ana: TestUser;
  let bea: TestUser;
  let carla: TestUser;
  let withBea: string;
  let withCarla: string;

  async function open(a: TestUser, b: TestUser): Promise<string> {
    const { data, error } = await a.client.rpc("create_conversation_with_members", { target_user_id: b.id });
    if (error) throw new Error(`open: ${error.message}`);
    return data as string;
  }

  async function send(u: TestUser, conversation: string, content: string): Promise<void> {
    const { error } = await u.client.from("messages").insert({ conversation_id: conversation, sender_id: u.id, content });
    if (error) throw new Error(`send: ${error.message}`);
  }

  beforeAll(async () => {
    ana = await createUser("chat-ana");
    bea = await createUser("chat-bea");
    carla = await createUser("chat-carla");
    await makeFriends(ana, bea);
    await makeFriends(ana, carla);
    withBea = await open(ana, bea);
    withCarla = await open(ana, carla);
    await send(ana, withBea, "primero");
    await send(bea, withBea, "segundo");
    await send(bea, withBea, "último de bea");
  });

  afterAll(async () => {
    await deleteCreatedUsers();
  });

  it("devuelve el otro miembro y el último mensaje de cada conversación", async () => {
    const res = await listConversations(ana.client as unknown as SupabaseClient, ana.id);
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    const bConv = res.value.find((c) => c.id === withBea);
    const cConv = res.value.find((c) => c.id === withCarla);
    expect(bConv?.otherUser?.id).toBe(bea.id);
    expect(bConv?.lastMessage).toEqual({ content: "último de bea", isMine: false });
    expect(bConv?.unread).toBe(true);

    // Sin mensajes: sin último mensaje y nada sin leer.
    expect(cConv?.otherUser?.id).toBe(carla.id);
    expect(cConv?.lastMessage).toBeNull();
    expect(cConv?.unread).toBe(false);
  });

  it("desde el otro lado, el último mensaje es mío", async () => {
    const res = await listConversations(bea.client as unknown as SupabaseClient, bea.id);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const conv = res.value.find((c) => c.id === withBea);
    expect(conv?.otherUser?.id).toBe(ana.id);
    expect(conv?.lastMessage).toEqual({ content: "último de bea", isMine: true });
  });
});
