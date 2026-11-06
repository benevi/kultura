// CUJ 3 · Buscar y añadir (F3-4 + F3-5): escribir en el buscador de
// Descubrir (TMDB con datos fijos que FILTRA por la consulta, ver
// offline-fetch.cjs), abrir la ficha y añadir a la biblioteca → fila en
// `user_media` y ficha del catálogo creada desde el proveedor.
import { test, expect } from "./fixtures";
import { admin, createUser, eventually, libraryEntry, login } from "./_db";

// «Interstellar» (fixtures.cjs): ningún otro CUJ lo usa, así la fila de
// `media` solo puede crearla este recorrido.
const MEDIA_ID = "movie_157336";

test("buscar y añadir: de la búsqueda a la biblioteca", async ({ page }) => {
  await admin.from("media").delete().eq("id", MEDIA_ID);
  const user = await createUser("busca");
  await login(page, user);

  await page.goto("/es/discover?type=movie&page=1");
  const box = page.locator("input[type=search]").first();
  await box.fill("Interstellar");
  await box.press("Enter");
  await page.waitForURL(/q=Interstellar/);

  const card = page.locator('a[href$="/media/movie/157336"]').first();
  await expect(card).toBeVisible();
  // Lo que no coincide con la búsqueda no sale.
  await expect(page.locator('a[href$="/media/movie/603"]')).toHaveCount(0);
  await card.click();

  await page.waitForURL(/\/es\/media\/movie\/157336/);
  await page.getByRole("button", { name: /Añadir a biblioteca/ }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Estado").selectOption("pending");
  await dialog.getByRole("button", { name: "Guardar" }).click();
  await expect(dialog).toBeHidden();

  const entry = await eventually(() => libraryEntry(user.id, MEDIA_ID), (e) => e !== null, "entrada en user_media");
  expect(entry!.status).toBe("pending");
  const { data: media } = await admin.from("media").select("id, title").eq("id", MEDIA_ID).maybeSingle();
  expect(media?.title).toBe("Interstellar");

  // Y aparece en su biblioteca.
  await page.goto("/es/library");
  await expect(page.getByText("Interstellar").first()).toBeVisible();
});
