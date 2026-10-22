/**
 * `(app)/layout.tsx` sin sesión: UNA redirección al login con locale (SEO-13).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetUser = vi.fn();
const mockHeaders = new Map<string, string>();

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => ({
    auth: { getUser: mockGetUser },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }) }),
  }),
}));

vi.mock("next/headers", () => ({
  headers: () => ({ get: (k: string) => mockHeaders.get(k) ?? null }),
}));

class RedirectSignal extends Error {
  constructor(public url: string) {
    super(`NEXT_REDIRECT ${url}`);
  }
}
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new RedirectSignal(url);
  },
}));

vi.mock("@/lib/social/notifications", () => ({ getUnreadCount: async () => 0 }));
// El layout no llega a pintar nada en estos casos; los componentes se
// sustituyen para no arrastrar sus dependencias de navegación.
vi.mock("@/components/layout/AuthHeader", () => ({ AuthHeader: () => null }));
vi.mock("@/components/layout/BottomNav", () => ({ BottomNav: () => null }));
vi.mock("@/components/layout/AppFooter", () => ({ AppFooter: () => null }));
vi.mock("@/components/ui/ToastProvider", () => ({ ToastProvider: () => null }));
vi.mock("@/components/layout/UnreadChatProvider", () => ({ UnreadChatProvider: () => null }));
vi.mock("@/components/layout/DemoBanner", () => ({ DemoBanner: () => null }));

import AppLayout from "@/app/[locale]/(app)/layout";

async function redirectOf(locale: string): Promise<string> {
  try {
    await AppLayout({ children: null, params: Promise.resolve({ locale }) });
  } catch (e) {
    if (e instanceof RedirectSignal) return e.url;
    throw e;
  }
  throw new Error("no redirigió");
}

describe("(app)/layout sin sesión", () => {
  beforeEach(() => {
    mockHeaders.clear();
    mockGetUser.mockResolvedValue({ data: { user: null } });
  });

  // Regresión: era `redirect('/login')`, que obligaba a un segundo salto de
  // next-intl hasta `/es/login` y perdía la página de la que se venía.
  it("va directo a /{locale}/login", async () => {
    expect(await redirectOf("en")).toBe("/en/login");
  });

  it("con la ruta de la petición (x-pathname) la pasa como next", async () => {
    mockHeaders.set("x-pathname", "/es/library");
    expect(await redirectOf("es")).toBe("/es/login?next=%2Fes%2Flibrary");
  });

  it("ignora una x-pathname peligrosa", async () => {
    mockHeaders.set("x-pathname", "//evil.com");
    expect(await redirectOf("es")).toBe("/es/login");
  });

  it("sesión sin perfil → login con locale", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    expect(await redirectOf("es")).toBe("/es/login");
  });
});
