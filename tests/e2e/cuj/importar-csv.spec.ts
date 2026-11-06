// CUJ 7 · Importar CSV (F3-10): un CSV con el formato de importación de
// Letterboxd (tmdbID) se lee en el navegador, se procesa por lotes en
// /api/account/import/external y deja la biblioteca escrita en la BD.
import { test, expect } from "@playwright/test";
import { createUser, eventually, libraryEntry, login } from "./_db";

const CSV = [
  "tmdbID,Title,Year,Rating10,WatchedDate",
  "603,Matrix,1999,9,2026-10-01",
  "27205,Origen,2010,8,2026-10-02",
].join("\n");

test("importar CSV: dos títulos de Letterboxd acaban en la biblioteca", async ({ page }) => {
  const user = await createUser("importa");
  await login(page, user);

  await page.goto("/es/settings/import");
  await page.locator('input[type="file"]').setInputFiles({
    name: "kultura-cuj.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(CSV, "utf-8"),
  });

  await page.getByRole("button", { name: /Importar 2 títulos/ }).click();
  await expect(page.getByText("Importación terminada")).toBeVisible({ timeout: 30_000 });

  for (const mediaId of ["movie_603", "movie_27205"]) {
    const entry = await eventually(() => libraryEntry(user.id, mediaId), (e) => e !== null, `${mediaId} importado`);
    expect(entry!.status).toBe("completed");
  }
});
