// ============================================================
// F-29 · Página /u/[username]/r/[type]/[id] y su tarjeta (CRE-8a)
// ============================================================

import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import es from "../../../messages/es.json";
import { createWorld, worldClient, type ShareWorld } from "./share-fakes";

const h = vi.hoisted(() => ({
  world: null as unknown as ShareWorld,
  sessionUser: null as null | { id: string },
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
  permanentRedirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT ${url}`);
  }),
  renamed: vi.fn(async () => null as string | null),
}));

vi.mock("next/navigation", () => ({ notFound: h.notFound, permanentRedirect: h.permanentRedirect }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => worldClient(h.world, "admin") }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => {
    const c = worldClient(h.world, h.sessionUser ? `user:${h.sessionUser.id}` : "anon", h.sessionUser?.id ?? null);
    return { ...c, auth: { ...c.auth, getUser: async () => ({ data: { user: h.sessionUser }, error: null }) } };
  },
}));
vi.mock("@/lib/media/detail-data", () => ({ loadMediaDetail: async () => null }));
vi.mock("@/lib/social/public-collection", async (orig) => ({
  ...(await orig<typeof import("@/lib/social/public-collection")>()),
  resolveRenamedUsername: h.renamed,
}));
vi.mock("next-intl/server", () => {
  const pick = (ns: string, key: string) => {
    const tree = (es as unknown as Record<string, Record<string, unknown>>)[ns];
    return key.split(".").reduce<unknown>((o, k) => (o as Record<string, unknown>)?.[k], tree) as string;
  };
  return {
    getTranslations: async ({ namespace }: { namespace: string }) => {
      const t = (key: string, values: Record<string, string> = {}) =>
        (pick(namespace, key) ?? key).replace(/\{(\w+)\}/g, (_, k) => values[k] ?? "");
      t.raw = (key: string) => pick(namespace, key);
      return t;
    },
  };
});
vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={`/es${href}`} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("@/components/layout/Header", () => ({ Header: () => <header data-testid="public-header" /> }));
vi.mock("@/components/layout/Footer", () => ({ Footer: () => <footer /> }));
vi.mock("@/components/collection/PublicCollection", () => ({
  SignedInBar: () => <header data-testid="signed-in-bar" />,
  SignUpCta: ({ href }: { href: string }) => <a data-testid="signup" href={href} />,
}));
vi.mock("next/image", () => ({
  // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
  default: ({ src }: { src: string }) => <img src={src} data-testid="poster" />,
}));

import RatedTitlePage, { generateMetadata } from "@/app/[locale]/u/[username]/r/[type]/[id]/page";
import { ratingShareSignature } from "@/app/[locale]/u/[username]/r/_lib/rating-share";

const SIG = () => ratingShareSignature("owner", "movie_438631")!;
const props = (sp: Record<string, string> = {}, over: Partial<{ username: string; id: string }> = {}) => ({
  params: Promise.resolve({ locale: "es", username: over.username ?? "benevi", type: "movie", id: over.id ?? "438631" }),
  searchParams: Promise.resolve(sp),
});

beforeEach(() => {
  h.world = createWorld();
  h.world.rpc.can_read_library = ({ p_owner, uid }) => ({ data: p_owner === uid || uid === "friend", error: null });
  h.world.rpc.has_block_with = () => ({ data: false, error: null });
  h.sessionUser = null;
  h.renamed.mockReset().mockResolvedValue(null);
  process.env.RATING_SCALE_10 = "1";
});

describe("metadatos", () => {
  it("con el enlace firmado: título con la nota y la tarjeta FIRMADA con alt traducido", async () => {
    const md = await generateMetadata(props({ s: SIG(), ref: "benevi" }));
    expect(md.title).toBe("@benevi le da 9/10 a Dune · KULTURA");
    expect(md.robots).toEqual({ index: false, follow: true });
    const og = (md.openGraph as { images: Array<{ url: string; alt: string; width: number }> }).images[0];
    expect(og.url).toBe(`https://kulturaapp.vercel.app/es/u/benevi/r/movie/438631/card/${SIG()}?v=9`);
    expect(og.alt).toBe("@benevi le da 9/10 a Dune en KULTURA");
    expect(og.width).toBe(1200);
    expect((md.twitter as { card: string }).card).toBe("summary_large_image");
    expect(md.alternates).toEqual({ canonical: "/es/u/benevi/r/movie/438631" });
  });

  it("amigo con sesión sin firma: ve la nota, pero la tarjeta es la GENÉRICA (la firma nunca sale en su HTML)", async () => {
    h.sessionUser = { id: "friend" };
    const md = await generateMetadata(props());
    expect(md.title).toBe("@benevi le da 9/10 a Dune · KULTURA");
    const og = (md.openGraph as { images: Array<{ url: string; alt: string }> }).images[0];
    expect(og.url).toBe("https://kulturaapp.vercel.app/es/u/benevi/r/movie/438631/opengraph-image");
    expect(og.alt).toBe("Dune en KULTURA");
    expect(JSON.stringify(md)).not.toContain(SIG());
  });

  it("anónimo sin firma: genérico de punta a punta", async () => {
    const md = await generateMetadata(props());
    expect(md.title).toBe("Dune en KULTURA · KULTURA");
    expect(JSON.stringify(md)).not.toContain("9/10");
  });
});

describe("regresión (PR #51): la firma no sale en los metadatos sin una firma válida", () => {
  type Images = { images?: unknown[] };
  const branches: Array<[string, () => void, Record<string, string>, Partial<{ username: string; id: string }>?]> = [
    ["usuario inexistente", () => {}, {}, { username: "nadie" }],
    ["título que no se puede cargar (proveedor caído)", () => {
      h.world.db.tables.media = [];
      h.world.db.tables.user_media = [];
    }, {}, { id: "693134" }],
    ["id de título imposible", () => {}, {}, { id: "x y" }],
    ["anónimo sin firma", () => {}, {}],
    ["anónimo con firma inventada", () => {}, { s: "AAAAAAAAAAAAAAAAAAAAAA" }],
    ["firma de otro título", () => {}, { s: "OTRA" }],
    ["biblioteca 'Solo yo' con firma válida", () => {
      h.world.db.tables.users[0].library_visibility = "private";
    }, { s: "VALID" }],
    ["bloqueo con firma válida", () => {
      h.sessionUser = { id: "stranger" };
      h.world.rpc.has_block_with = () => ({ data: true, error: null });
    }, { s: "VALID" }],
    ["amigo con sesión sin firma", () => {
      h.sessionUser = { id: "friend" };
    }, {}],
    ["dueño sin firma", () => {
      h.sessionUser = { id: "owner" };
    }, {}],
    ["la base falla al leer el dueño", () => {
      h.world.db.failures.users = { code: "XX000", message: "boom" };
    }, { s: "VALID" }],
  ];

  it.each(branches)("%s: sin firma y con `images` explícito (nunca el de los archivos)", async (_name, setup, sp, over) => {
    setup();
    const query = { ...sp };
    if (query.s === "VALID") query.s = SIG();
    if (query.s === "OTRA") query.s = ratingShareSignature("owner", "movie_841")!;
    const md = await generateMetadata(props(query, over ?? {}));
    const dump = JSON.stringify(md);
    // La firma VÁLIDA de esta nota no puede salir (sí puede repetirse la que
    // trae la petición si no vale: no da acceso a nada).
    if (query.s !== SIG()) expect(dump).not.toContain(SIG());
    else expect(dump).not.toContain(`/card/${SIG()}`);
    expect(dump).not.toContain("/card/");
    expect(Array.isArray((md.openGraph as Images | undefined)?.images)).toBe(true);
    expect(Array.isArray((md.twitter as Images | undefined)?.images)).toBe(true);
  });

  it("solo con la firma válida sale la tarjeta firmada", async () => {
    const md = await generateMetadata(props({ s: SIG() }));
    expect(JSON.stringify(md)).toContain(`/card/${SIG()}`);
  });

  it("no encontrado: tarjeta vacía a propósito", async () => {
    const md = await generateMetadata(props({}, { username: "nadie" }));
    expect(md.openGraph).toEqual({ images: [] });
    expect(md.twitter).toEqual({ images: [] });
    expect(md.robots).toEqual({ index: false, follow: true });
  });
});

describe("página", () => {
  it("con firma: '@benevi le da 9/10 a Dune', portada, enlaces y alta con atribución", async () => {
    render(await RatedTitlePage(props({ s: SIG(), ref: "benevi" })));
    const h1 = screen.getByRole("heading", { level: 1 });
    expect(h1).toHaveTextContent("@benevi le da 9/10 a Dune");
    expect(screen.getByTestId("poster")).toHaveAttribute("src", "https://image.tmdb.org/t/p/w500/d.jpg");
    expect(screen.getByRole("link", { name: "Ver la ficha" })).toHaveAttribute("href", "/es/media/movie/438631");
    expect(screen.getByRole("link", { name: "Ver el perfil de @benevi" })).toHaveAttribute("href", "/es/u/benevi");
    const signup = screen.getByTestId("signup").getAttribute("href")!;
    expect(signup).toContain("/login?mode=register&next=%2Fes%2Fmedia%2Fmovie%2F438631");
    expect(signup).toContain("ref=benevi");
    expect(screen.getByTestId("public-header")).toBeInTheDocument();
  });

  it("sin firma: genérica, sin nota en ninguna parte", async () => {
    const { container } = render(await RatedTitlePage(props()));
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Dune en KULTURA");
    expect(container.textContent).not.toContain("9/10");
  });

  it("el dueño ve su nota y el aviso de quién la ve", async () => {
    h.sessionUser = { id: "owner" };
    render(await RatedTitlePage(props()));
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("9/10");
    expect(screen.getByText(es.share.page.ownerHint)).toBeInTheDocument();
    expect(screen.getByTestId("signed-in-bar")).toBeInTheDocument();
    expect(screen.queryByTestId("signup")).toBeNull();
  });

  it("usuario inexistente → 404; nombre antiguo → 308 al actual conservando firma y ref", async () => {
    await expect(RatedTitlePage(props({}, { username: "nadie" }))).rejects.toThrow("NEXT_NOT_FOUND");
    h.renamed.mockResolvedValue("benevi");
    await expect(RatedTitlePage(props({ s: SIG(), ref: "viejo" }, { username: "viejo" }))).rejects.toThrow(
      `REDIRECT /es/u/benevi/r/movie/438631?s=${SIG()}&ref=viejo`
    );
  });

  it("id de título imposible → 404 sin buscar renombrados", async () => {
    await expect(RatedTitlePage(props({}, { id: "x y" }))).rejects.toThrow("NEXT_NOT_FOUND");
    expect(h.renamed).not.toHaveBeenCalled();
  });
});
