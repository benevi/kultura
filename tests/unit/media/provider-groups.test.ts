import { describe, expect, it } from "vitest";
import { groupProviderVariants, providerServiceKey } from "@/lib/media/provider-groups";

const p = (name: string) => ({ name });

describe("«Dónde ver»: variantes de un servicio (F6)", () => {
  it("quita los sufijos de variante y aplica los alias", () => {
    expect(providerServiceKey("Amazon Prime Video with Ads")).toBe("amazon prime video");
    expect(providerServiceKey("HBO Max Amazon Channel")).toBe("hbo max");
    expect(providerServiceKey("Netflix Standard with Ads")).toBe("netflix");
    expect(providerServiceKey("Max")).toBe("hbo max");
    expect(providerServiceKey("Apple TV")).toBe("apple tv");
  });

  it("junta variantes con el nombre literal de la principal y conserva el orden", () => {
    const groups = groupProviderVariants([
      p("Amazon Prime Video with Ads"),
      p("Netflix"),
      p("Amazon Prime Video"),
      p("HBO Max Amazon Channel"),
      p("Filmin"),
    ]);
    expect(groups.map((g) => g.main.name)).toEqual(["Amazon Prime Video", "Netflix", "HBO Max Amazon Channel", "Filmin"]);
    expect(groups[0].variants.map((v) => v.name)).toEqual(["Amazon Prime Video with Ads"]);
    // Sin la variante «HBO Max» en los datos no se inventa ese nombre.
    expect(groups[2].variants).toEqual([]);
  });

  it("no junta servicios distintos", () => {
    expect(groupProviderVariants([p("Amazon Video"), p("Amazon Prime Video")])).toHaveLength(2);
  });
});
