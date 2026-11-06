// CUJ 3 · Buscar y añadir (F3-4 + F3-5): buscar en Descubrir (TMDB con datos
// fijos, sin red), abrir la ficha y añadir a la biblioteca → fila en
// `user_media` y ficha del catálogo creada desde el proveedor.
import { test, expect } from "@playwright/test";
import { admin, createUser, eventually, libraryEntry, login } from "./_db";

const MEDIA_ID = "movie_603"; // «Matrix» en tests/e2e/a11y/fixtures.cjs

test("buscar y añadir: de la búsqueda a la biblioteca", async ({ page }) => {
  const user = await createUser("busca");
  await login(page, user);

  await page.goto("/es/discover?type=movie&page=1&q=Matrix");
  const card = page.locator('a[href$="/media/movie/603"]').first();
  await expect(card).toBeVisible();
  await card.click();

  await page.waitForURL(/\/es\/media\/movie\/603/);
  await page.getByRole("button", { name: /Añadir a biblioteca/ }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Estado").selectOption("pending");
  await dialog.getByRole("button", { name: "Guardar" }).click();
  await expect(dialog).toBeHidden();

  const entry = await eventually(() => libraryEntry(user.id, MEDIA_ID), (e) => e !== null, "entrada en user_media");
  expect(entry!.status).toBe("pending");
  const { data: media } = await admin.from("media").select("id, title").eq("id", MEDIA_ID).maybeSingle();
  expect(media?.title).toBe("Matrix");

  // Y aparece en su biblioteca.
  await page.goto("/es/library");
  await expect(page.getByText("Matrix").first()).toBeVisible();
});
