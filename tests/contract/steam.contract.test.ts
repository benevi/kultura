/**
 * Contrato — tienda de Steam (precio, capturas e idiomas en la ficha de
 * juego). Sin clave. Llama a los clientes reales con
 * `PROVIDER_CONTRACT_MODE=enforce`.
 */
import { describe, it, expect } from "vitest";
import { expectFieldCoverage, pause } from "./helpers";
import {
  getSteamAppDetails,
  searchSteamAppId,
  toSteamInfo,
  probeSteam,
} from "@/lib/api/steam";

const HADES = 1145360;

describe("Steam", () => {
  it("ficha de tienda: cumple el contrato y trae lo que pinta la ficha", async () => {
    const data = await getSteamAppDetails(HADES, "es");
    expect(data).not.toBeNull();
    expectFieldCoverage([data], ["type", "is_free", "supported_languages", "screenshots"], 1);
    const info = toSteamInfo(HADES, data!);
    expect(info.screenshots?.length).toBeGreaterThan(0);
  });

  it("búsqueda por nombre: encuentra el appid exacto", async () => {
    await pause(500);
    expect(await searchSteamAppId("Hades", "es")).toBe(HADES);
  });

  it("sonda de /api/health?deep=1", async () => {
    await pause(500);
    await expect(probeSteam()).resolves.toBeUndefined();
  });
});
