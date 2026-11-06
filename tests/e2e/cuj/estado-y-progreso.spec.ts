// CUJ 4 · Cambiar estado y progreso (F3-6): una serie pendiente pasa a «En
// curso» con temporada y episodio; persiste en la BD y al recargar la ficha.
import { test, expect } from "@playwright/test";
import { admin, createUser, ensureMedia, eventually, libraryEntry, login } from "./_db";

const MEDIA_ID = "tv_1399";

test("estado y progreso: pendiente → en curso T1E3", async ({ page }) => {
  const user = await createUser("progreso");
  await ensureMedia(MEDIA_ID, "Título 1399", "tv", 2011);
  const { error } = await admin.from("user_media").insert({ user_id: user.id, media_id: MEDIA_ID, status: "pending" });
  expect(error).toBeNull();

  await login(page, user);
  await page.goto("/es/media/tv/1399");
  await page.getByRole("button", { name: "Actualizar" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Estado").selectOption("in_progress");
  await dialog.getByTestId("input-season").fill("1");
  await dialog.getByTestId("input-episode").fill("3");
  await dialog.getByRole("button", { name: "Guardar" }).click();
  await expect(dialog).toBeHidden();

  const entry = await eventually(
    () => libraryEntry(user.id, MEDIA_ID),
    (e) => e?.status === "in_progress",
    "estado en curso en user_media",
  );
  // Con PROGRESS_V2 va a las columnas; sin ella, al jsonb antiguo.
  const legacy = entry!.episode_progress as { episode?: number } | null;
  expect(entry!.progress_episode ?? legacy?.episode).toBe(3);

  // Al recargar, el modal vuelve con lo guardado.
  await page.reload();
  await page.getByRole("button", { name: "Actualizar" }).click();
  await expect(page.getByRole("dialog").getByLabel("Estado")).toHaveValue("in_progress");
  await expect(page.getByRole("dialog").getByTestId("input-episode")).toHaveValue("3");
});
