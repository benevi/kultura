// CUJ 5 · Crear lista y compartir (F3-8): crear una lista pública, añadirle un
// título desde la ficha y abrir su enlace público sin sesión.
import { test, expect } from "@playwright/test";
import { admin, createUser, eventually, login, uniq } from "./_db";

test("lista: crear pública, añadir título y abrir el enlace sin sesión", async ({ page, browser }) => {
  const user = await createUser("listas");
  const name = `Lista CUJ ${uniq()}`;
  await login(page, user);

  await page.goto("/es/lists");
  await page.getByRole("button", { name: "Nueva lista" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Nombre de la lista").fill(name);
  await dialog.getByRole("radio", { name: /Pública/ }).check();
  await dialog.getByRole("button", { name: "Crear", exact: true }).click();
  await page.waitForURL(/\/es\/lists\/[0-9a-f-]{36}/);
  const listId = page.url().match(/lists\/([0-9a-f-]{36})/)![1];

  const { data: list } = await admin.from("lists").select("owner_id, is_public, name").eq("id", listId).single();
  expect(list).toMatchObject({ owner_id: user.id, is_public: true, name });

  // Añadir «Matrix» desde su ficha.
  await page.goto("/es/media/movie/603");
  await page.getByRole("button", { name: "Añadir a lista" }).click();
  const addDialog = page.getByRole("dialog");
  await addDialog.getByText(name).click();
  await addDialog.getByRole("button", { name: "Añadir", exact: true }).click();
  await eventually(
    async () => (await admin.from("list_items").select("media_id").eq("list_id", listId)).data ?? [],
    (rows) => rows.some((r) => r.media_id === "movie_603"),
    "título en list_items",
  );

  // El dueño ve el botón de compartir; el enlace público abre sin sesión.
  await page.goto(`/es/lists/${listId}`);
  await expect(page.getByRole("button", { name: /Compartir/ })).toBeVisible();

  const anon = await browser.newContext({ bypassCSP: true, locale: "es-ES" });
  const visitor = await anon.newPage();
  await visitor.goto(`/es/u/${user.username}/l/${listId}`);
  await expect(visitor.getByRole("heading", { name })).toBeVisible();
  await expect(visitor.getByText("Matrix").first()).toBeVisible();
  await anon.close();
});
