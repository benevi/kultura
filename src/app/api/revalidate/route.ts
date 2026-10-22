// ============================================================
// KULTURA — POST /api/revalidate (F-06, COD-9)
// Vacía las cachés etiquetadas sin desplegar (p. ej. un ranking que quedó con
// datos malos). Protegida con `REVALIDATE_SECRET` (variable de entorno de
// Vercel); sin ella configurada, la ruta no existe (404).
//
//   curl -X POST https://<dominio>/api/revalidate \
//     -H "Authorization: Bearer $REVALIDATE_SECRET" \
//     -H "Content-Type: application/json" -d '{"tags":["best-of"]}'
// ============================================================

import { createHash, timingSafeEqual } from "crypto";
import { revalidateTag } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { BEST_CACHE_TAG, REVALIDATABLE_TAGS } from "@/lib/best/cache-tags";
import { clientIp } from "@/lib/api/discover-params";
import { checkRateLimit } from "@/lib/rate-limit";

const LIMIT = { windowMs: 60_000, max: 10 };

function sameSecret(given: string, expected: string): boolean {
  // Se comparan los hashes para que la longitud no se filtre por tiempo.
  const a = createHash("sha256").update(given).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

export async function POST(request: NextRequest) {
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const rl = checkRateLimit(`${clientIp(request.headers)}:revalidate`, LIMIT);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } }
    );
  }

  const auth = request.headers.get("authorization") ?? "";
  const given = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!given || !sameSecret(given, secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let tags: string[] = [BEST_CACHE_TAG];
  const raw = await request.text();
  if (raw.trim()) {
    try {
      const body = JSON.parse(raw) as { tags?: unknown };
      if (body.tags !== undefined) {
        if (!Array.isArray(body.tags) || body.tags.length === 0) throw new Error("tags");
        tags = body.tags.map(String);
      }
    } catch {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }
  }

  const unknown = tags.filter((t) => !REVALIDATABLE_TAGS.includes(t));
  if (unknown.length > 0) {
    return NextResponse.json({ error: "Unknown tags", tags: unknown }, { status: 400 });
  }

  tags.forEach((t) => revalidateTag(t));
  return NextResponse.json(
    { revalidated: tags, now: Date.now() },
    { headers: { "Cache-Control": "no-store" } }
  );
}
