// CUJ 8 · Exportar (F3-10): «Exportar mis datos» en Ajustes descarga un JSON
// con la biblioteca y las listas reales del usuario (y de nadie más).
import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { admin, createUser, ensureMedia, login, uniq } from "./_db";

test("exportar: el JSON descargado contiene su biblioteca y sus listas", async ({ page }) => {
  const user = await createUser("exporta");
  const other = await createUser("ajeno");
  const listName = `Export ${uniq()}`;
  await ensureMedia("movie_550", "El club de la lucha", "movie", 1999);
  await ensureMedia("movie_680", "Pulp Fiction", "movie", 1994);
  const seeds = await Promise.all([
    admin.from("user_media").insert({ user_id: user.id, media_id: "movie_550", status: "completed" }),
    admin.from("user_media").insert({ user_id: other.id, media_id: "movie_680", status: "completed" }),
    admin.from("lists").insert({ owner_id: user.id, name: listName, media_type: "movie", is_public: false }),
  ]);
  for (const s of seeds) expect(s.error).toBeNull();

  await login(page, user);
  await page.goto("/es/settings");
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Exportar mis datos" }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^kultura-export-\d{4}-\d{2}-\d{2}\.json$/);

  const text = await readFile((await download.path())!, "utf-8");
  const data = JSON.parse(text);
  expect(text).toContain("movie_550");
  expect(text).toContain(listName);
  // Nada de otra persona.
  expect(text).not.toContain("movie_680");
  expect(text).not.toContain(other.id);
  expect(JSON.stringify(data.profile ?? {})).toContain(user.username);
});
