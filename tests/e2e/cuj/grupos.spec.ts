// Red de seguridad 4 · Grupos: A crea un grupo privado e invita a B (amigos);
// B acepta la invitación en Notificaciones, entra y publica, y A ve el post.
// Además, C se une a un grupo público desde Descubrir.
import { test, expect } from "./fixtures";
import { admin, createUser, eventually, uniq } from "./_db";
import { makeFriends, pageFor } from "./_social";

test("grupos: crear, invitar, aceptar y publicar", async ({ browser }) => {
  const a = await createUser("grupa");
  const b = await createUser("grupb");
  await makeFriends(a, b);
  const pageA = await pageFor(browser, a);
  const pageB = await pageFor(browser, b);
  const name = `Club ${uniq()}`;

  // A crea un grupo privado.
  await pageA.goto("/es/groups");
  await pageA.getByRole("button", { name: "+ Crear grupo" }).click();
  await pageA.getByRole("textbox", { name: "Nombre del grupo" }).fill(name);
  await pageA.getByRole("group", { name: "Visibilidad" }).getByRole("button", { name: "Privado" }).click();
  await pageA.getByRole("button", { name: "Crear grupo", exact: true }).click();
  await pageA.getByRole("link", { name: new RegExp(name) }).first().click();
  await pageA.waitForURL(/\/groups\/[0-9a-f-]{36}/);
  await expect(pageA.getByRole("heading", { level: 1, name })).toBeVisible();
  const groupId = pageA.url().match(/groups\/([0-9a-f-]{36})/)![1];

  // A invita a B.
  await pageA.locator("main").getByRole("button", { name: /Invitar/ }).first().click();
  const dialog = pageA.getByRole("dialog", { name: "Invitar amigos" });
  await dialog.getByRole("listitem").filter({ hasText: b.username }).getByRole("button", { name: "Invitar" }).click();
  await expect(pageA.getByText("Invitación enviada")).toBeVisible();

  // B la acepta en Notificaciones (los botones solo están en la primera visita).
  await pageB.goto("/es/notifications");
  await expect(pageB.getByText("te invitó al grupo")).toBeVisible();
  await pageB.getByRole("button", { name: `Aceptar la invitación a ${name}` }).click();
  await expect(pageB.getByText("Te has unido al grupo")).toBeVisible();
  await eventually(
    async () => (await admin.from("group_members").select("role").eq("group_id", groupId).eq("user_id", b.id)).data,
    (rows) => (rows?.length ?? 0) === 1,
    "B es miembro",
  );

  // B publica en el grupo (por la API de la fase 4) y A lo ve.
  const post = `Hola desde el E2E ${uniq()}`;
  await pageB.goto(`/es/groups/${groupId}`);
  await pageB.getByRole("textbox", { name: "Escribe algo en el grupo…" }).fill(post);
  await pageB.getByRole("button", { name: "Publicar" }).click();
  await eventually(
    async () => (await admin.from("group_posts").select("id").eq("group_id", groupId).eq("content", post)).data,
    (rows) => (rows?.length ?? 0) === 1,
    "post guardado",
  );

  await pageA.goto(`/es/groups/${groupId}`);
  await expect(pageA.getByText(post)).toBeVisible();

  await pageA.context().close();
  await pageB.context().close();
});

test("grupos: unirse a un grupo público desde Descubrir", async ({ browser }) => {
  const owner = await createUser("grupo");
  const c = await createUser("grupc");
  const name = `Abierto ${uniq()}`;
  const groupId = crypto.randomUUID();
  const { error } = await admin.from("groups").insert({ id: groupId, name, owner_id: owner.id, is_public: true });
  expect(error).toBeNull();

  const pageC = await pageFor(browser, c);
  await pageC.goto("/es/groups");
  await pageC.getByRole("button", { name: "Descubrir" }).click();
  await pageC.getByRole("searchbox", { name: "Buscar grupos…" }).fill(name);
  await pageC.getByRole("link", { name: new RegExp(name) }).first().click();
  await pageC.waitForURL(new RegExp(`/groups/${groupId}`));
  await pageC.getByRole("button", { name: "Unirse" }).click();
  await expect(pageC.getByRole("button", { name: "Salir" })).toBeVisible();
  await expect(pageC.getByRole("textbox", { name: "Escribe algo en el grupo…" })).toBeVisible();

  await pageC.context().close();
});
