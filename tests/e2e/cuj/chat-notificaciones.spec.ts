// Red de seguridad 4 · Chat y notificaciones: A abre una conversación con su
// amigo B y le escribe; B lo lee en su chat. B recomienda un título a A y A lo
// ve en Notificaciones.
import { test, expect } from "./fixtures";
import { admin, createUser, ensureMedia, uniq } from "./_db";
import { makeFriends, pageFor } from "./_social";

test("chat: A escribe a B y B lo lee", async ({ browser }) => {
  const a = await createUser("chata");
  const b = await createUser("chatb");
  await makeFriends(a, b);
  const pageA = await pageFor(browser, a);
  const pageB = await pageFor(browser, b);

  await pageA.goto("/es/chat");
  await pageA.getByRole("button", { name: "+ Nueva conversación" }).click();
  await pageA.getByTestId("friend-picker-item").filter({ hasText: b.username }).click();
  await pageA.waitForURL(/\/chat\/[0-9a-f-]{36}/);
  const conversation = pageA.url().match(/chat\/([0-9a-f-]{36})/)![1];

  const msg = `Hola ${uniq()}`;
  await pageA.getByRole("textbox", { name: "Mensaje" }).fill(msg);
  await pageA.getByRole("button", { name: "Enviar" }).click();
  await expect(pageA.getByRole("log").getByText(msg)).toBeVisible();

  // Guardado de verdad (no solo el mensaje optimista).
  await expect
    .poll(async () => (await admin.from("messages").select("id").eq("conversation_id", conversation).eq("content", msg)).data?.length ?? 0)
    .toBe(1);

  await pageB.goto(`/es/chat/${conversation}`);
  await expect(pageB.getByRole("log").getByText(msg)).toBeVisible();

  await pageA.context().close();
  await pageB.context().close();
});

test("notificaciones: una recomendación de un amigo aparece en Notificaciones", async ({ browser }) => {
  const a = await createUser("nota");
  const b = await createUser("notb");
  await makeFriends(a, b);
  await ensureMedia("movie_550", "El club de la lucha", "movie", 1999);
  const { error } = await admin.from("notifications").insert({
    user_id: a.id,
    type: "recommendation",
    payload: { fromUserId: b.id, fromUsername: b.username, mediaId: "movie_550", mediaTitle: "El club de la lucha", message: null },
  });
  expect(error).toBeNull();

  const pageA = await pageFor(browser, a);
  await pageA.goto("/es/notifications");
  await expect(pageA.getByRole("heading", { level: 1, name: "Notificaciones" })).toBeVisible();
  const item = pageA.getByRole("listitem").filter({ hasText: b.username });
  await expect(item).toContainText("te recomendó");
  await expect(item).toContainText("El club de la lucha");
  await expect(item).not.toContainText("undefined");

  await pageA.context().close();
});
