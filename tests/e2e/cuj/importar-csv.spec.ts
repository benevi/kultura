// CUJ 7 · Importar CSV (F3-10): un CSV con el formato de importación de
// Letterboxd se lee en el navegador, se procesa por lotes en
// /api/account/import/external y deja la biblioteca escrita en la BD, con su
// nota; lo que no se encuentra en el proveedor no se inventa.
import { test, expect } from "./fixtures";
import { admin, createUser, eventually, libraryEntry, login } from "./_db";

const CSV = [
  "tmdbID,Title,Year,Rating10,WatchedDate",
  "603,Matrix,1999,9,2026-10-01",
  "27205,Origen,2010,8,2026-10-02",
  // Sin id y con un título que la búsqueda (filtrada) no encuentra.
  ",Película inexistente CUJ,2001,7,2026-10-03",
].join("\n");

test("importar CSV: dos títulos con nota en la biblioteca y uno sin emparejar", async ({ page }) => {
  const user = await createUser("importa");
  await login(page, user);

  await page.goto("/es/settings/import");
  // Si el archivo llega antes de hidratar, el onChange aún no existe: se
  // reintenta hasta que aparece la vista previa.
  const start = page.getByRole("button", { name: /Importar 3 títulos/ });
  await expect(async () => {
    await page.locator('input[type="file"]').setInputFiles({
      name: "kultura-cuj.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(CSV, "utf-8"),
    });
    await expect(start).toBeVisible({ timeout: 3_000 });
  }).toPass({ timeout: 20_000 });

  await start.click();
  await expect(page.getByText("Importación terminada")).toBeVisible({ timeout: 30_000 });

  const expected: Record<string, number> = { movie_603: 9, movie_27205: 8 };
  for (const [mediaId, rating] of Object.entries(expected)) {
    const entry = await eventually(() => libraryEntry(user.id, mediaId), (e) => e !== null, `${mediaId} importado`);
    expect(entry!.status).toBe("completed");
    // RATING_SCALE_10=1 (env.cjs): la nota /10 vuelve tal cual.
    expect(Number(entry!.rating10)).toBe(rating);
  }
  const { count } = await admin.from("user_media").select("id", { count: "exact", head: true }).eq("user_id", user.id);
  expect(count).toBe(2);
});
