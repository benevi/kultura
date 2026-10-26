/**
 * F-22 (SEG-10) — receptor de informes de la CSP en /api/csp-report.
 * Los dos formatos de los navegadores, sin query ni fragmento en lo que se
 * registra, con tope de tamaño y de peticiones, y siempre 204 al navegador.
 */
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

const { warn } = vi.hoisted(() => ({ warn: vi.fn() }));
vi.mock("@/lib/logger", () => ({
  createLogger: () => ({ warn, error: vi.fn(), info: vi.fn(), debug: vi.fn() }),
}));

import { POST } from "@/app/api/csp-report/route";
import {
  CSP_REPORT_MAX_BYTES,
  CSP_REPORT_MAX_ITEMS,
  extractViolations,
  readBodyCapped,
  scrubUrl,
} from "@/app/api/csp-report/report";
import { _resetStoreForTests } from "@/lib/rate-limit";

function post(body: string, type = "application/csp-report", ip = "203.0.113.7") {
  return new Request("https://kultura.test/api/csp-report", {
    method: "POST",
    headers: { "content-type": type, "x-forwarded-for": ip },
    body,
  });
}

const LEGACY = {
  "csp-report": {
    "document-uri": "https://kulturaapp.vercel.app/es/best/movie/2026?utm_source=x#top",
    "blocked-uri": "https://evil.example/x.js?token=secreto",
    "effective-directive": "script-src-elem",
    "violated-directive": "script-src-elem",
    disposition: "enforce",
    "source-file": "https://kulturaapp.vercel.app/_next/static/chunks/app.js?v=1",
    "line-number": 12,
    "script-sample": "alert(document.cookie) y mucho más texto de relleno aquí",
  },
};

const REPORTING_API = [
  {
    type: "csp-violation",
    url: "https://kulturaapp.vercel.app/es",
    body: {
      documentURL: "https://kulturaapp.vercel.app/es?ref=amigo",
      blockedURL: "inline",
      effectiveDirective: "script-src-elem",
      disposition: "report",
      lineNumber: 3,
    },
  },
  { type: "deprecation", body: { id: "x" } },
];

beforeEach(() => {
  warn.mockClear();
  _resetStoreForTests();
});

describe("scrubUrl", () => {
  it("quita query y fragmento", () => {
    expect(scrubUrl("https://a.example/p/q?x=1#h")).toBe("https://a.example/p/q");
  });
  it("deja las palabras clave de la CSP y resume data:/blob:", () => {
    expect(scrubUrl("inline")).toBe("inline");
    expect(scrubUrl("eval")).toBe("eval");
    expect(scrubUrl("data:image/png;base64,AAAA")).toBe("data");
    expect(scrubUrl("blob:https://a.example/uuid")).toBe("blob");
  });
  it("descarta lo que no es URL ni palabra clave", () => {
    expect(scrubUrl("<script>alert(1)</script>")).toBeNull();
    expect(scrubUrl(42)).toBeNull();
    expect(scrubUrl("")).toBeNull();
  });
});

describe("extractViolations", () => {
  it("formato report-uri (application/csp-report)", () => {
    expect(extractViolations(LEGACY)).toEqual([
      {
        documentUrl: "https://kulturaapp.vercel.app/es/best/movie/2026",
        blockedUrl: "https://evil.example/x.js",
        directive: "script-src-elem",
        disposition: "enforce",
        sourceFile: "https://kulturaapp.vercel.app/_next/static/chunks/app.js",
        line: 12,
        sample: "alert(document.cookie) y mucho más texto",
      },
    ]);
  });

  it("formato Reporting API: solo las de tipo csp-violation", () => {
    const out = extractViolations(REPORTING_API);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      documentUrl: "https://kulturaapp.vercel.app/es",
      blockedUrl: "inline",
      disposition: "report",
    });
  });

  it(`como mucho ${CSP_REPORT_MAX_ITEMS} por lote`, () => {
    const many = Array.from({ length: 50 }, () => REPORTING_API[0]);
    expect(extractViolations(many)).toHaveLength(CSP_REPORT_MAX_ITEMS);
  });

  it("cuerpos que no son informes → nada", () => {
    expect(extractViolations(null)).toEqual([]);
    expect(extractViolations({ hola: 1 })).toEqual([]);
    expect(extractViolations("texto")).toEqual([]);
  });
});

describe("POST /api/csp-report", () => {
  it("204 y una línea warn por violación, sin query en las URL", async () => {
    const res = await POST(post(JSON.stringify(LEGACY)));
    expect(res.status).toBe(204);
    expect(warn).toHaveBeenCalledTimes(1);
    const [, ctx] = warn.mock.calls[0];
    expect(JSON.stringify(ctx)).not.toContain("token=secreto");
    expect(JSON.stringify(ctx)).not.toContain("utm_source");
  });

  it("acepta application/reports+json (Chromium)", async () => {
    const res = await POST(post(JSON.stringify(REPORTING_API), "application/reports+json"));
    expect(res.status).toBe(204);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("415 con otro tipo de contenido", async () => {
    const res = await POST(post(JSON.stringify(LEGACY), "text/plain"));
    expect(res.status).toBe(415);
    expect(warn).not.toHaveBeenCalled();
  });

  it("413 si pasa del tope", async () => {
    const big = JSON.stringify({ "csp-report": { "document-uri": "x".repeat(CSP_REPORT_MAX_BYTES) } });
    const res = await POST(post(big));
    expect(res.status).toBe(413);
  });

  it("400 si no es JSON", async () => {
    const res = await POST(post("{no json"));
    expect(res.status).toBe(400);
  });

  it("429 a partir de 30 peticiones por minuto de la misma IP", async () => {
    for (let i = 0; i < 30; i++) {
      expect((await POST(post(JSON.stringify(LEGACY), "application/csp-report", "198.51.100.1"))).status).toBe(204);
    }
    const res = await POST(post(JSON.stringify(LEGACY), "application/csp-report", "198.51.100.1"));
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBeTruthy();
  });

  it("413 sin leer el cuerpo si el Content-Length declarado pasa del tope", async () => {
    const req = new Request("https://kultura.test/api/csp-report", {
      method: "POST",
      headers: { "content-type": "application/csp-report", "content-length": String(CSP_REPORT_MAX_BYTES + 1) },
      body: "{}",
    });
    const text = vi.spyOn(req, "text");
    expect((await POST(req)).status).toBe(413);
    expect(text).not.toHaveBeenCalled();
  });

  it("sin Content-Length: lee por trozos y corta (cancela el flujo) al pasar de 16 KB", async () => {
    let pulled = 0;
    let cancelled = false;
    const chunk = new TextEncoder().encode("x".repeat(4096));
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulled++;
        controller.enqueue(chunk); // infinito: sin el corte no terminaría nunca
      },
      cancel() {
        cancelled = true;
      },
    });
    const req = new Request("https://kultura.test/api/csp-report", {
      method: "POST",
      headers: { "content-type": "application/csp-report" },
      body: stream,
      // @ts-expect-error -- `duplex` lo exige undici para cuerpos en flujo
      duplex: "half",
    });
    expect((await POST(req)).status).toBe(413);
    expect(cancelled).toBe(true);
    expect(pulled).toBeLessThanOrEqual(Math.ceil(CSP_REPORT_MAX_BYTES / chunk.byteLength) + 2);
  });
});

describe("readBodyCapped", () => {
  it("devuelve el texto entero si cabe", async () => {
    const req = new Request("https://kultura.test", { method: "POST", body: "hola ñ" });
    expect(await readBodyCapped(req, 100)).toBe("hola ñ");
  });

  it("null si pasa del tope y \"\" sin cuerpo", async () => {
    expect(await readBodyCapped(new Request("https://kultura.test", { method: "POST", body: "x".repeat(11) }), 10)).toBeNull();
    expect(await readBodyCapped(new Request("https://kultura.test"), 10)).toBe("");
  });
});
