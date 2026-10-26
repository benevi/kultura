// ============================================================
// KULTURA — Tarjeta FIRMADA "@benevi le da 9/10 a Dune" (CRE-8a, F-29)
//
// GET /[locale]/u/[username]/r/[type]/[id]/card/[sig]
// Un route handler y no un archivo de metadatos: así Next nunca la anuncia
// por su cuenta (con `generateImageMetadata` la firma acababa en el og:image
// de cualquier respuesta de la página, también en un 404). Solo la enlazan
// los metadatos de la página cuando la petición ya trae una firma válida.
//
// Firma que no vale para ese dueño y título (o usuario / título
// inexistentes): 404 sin cuerpo. Firma válida: la tarjeta con la nota, salvo
// que el dueño haya puesto su biblioteca en "Solo yo" (entonces, la genérica).
// Sin cookies: se pinta como la vería alguien sin cuenta.
// ============================================================

import { parseMediaId } from "@/lib/media/media-id";
import { findShareOwner, isValidRatingShareSignature } from "../../../../_lib/rating-share";
import { decode, renderRatedCard, type CardParams } from "../../../../_lib/rated-card";

type Params = CardParams & { sig: string };

const NOT_FOUND = () => new Response(null, { status: 404, headers: { "cache-control": "no-store" } });

export async function GET(_request: Request, { params }: { params: Promise<Params> }): Promise<Response> {
  const { sig, ...card } = await params;
  const parsed = parseMediaId(`${card.type}_${decode(card.id)}`);
  if (!parsed) return NOT_FOUND();
  const owner = await findShareOwner(decode(card.username)).catch(() => null);
  if (!owner || !isValidRatingShareSignature(owner.id, parsed.id, sig)) return NOT_FOUND();
  return renderRatedCard(card, sig);
}
