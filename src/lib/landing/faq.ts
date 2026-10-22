// ============================================================
// KULTURA — Preguntas frecuentes de la landing (CRE-10, SEO-9)
//
// Una sola lista para la sección visible y para el JSON-LD `FAQPage`: Google
// exige que el marcado repita EXACTAMENTE lo que se ve en la página.
// ============================================================

/** Orden de las preguntas. `demo` solo existe si la cuenta demo está configurada. */
export const FAQ_KEYS = ["free", "what", "demo", "privacy", "data", "ai"] as const;
export type FaqKey = (typeof FAQ_KEYS)[number];

export interface FaqItem {
  key: FaqKey;
  q: string;
  a: string;
}

/** Preguntas visibles: todas salvo la demo cuando no hay demo. */
export function faqKeys(hasDemo: boolean): FaqKey[] {
  return FAQ_KEYS.filter((k) => hasDemo || k !== "demo");
}

/** Marcado `FAQPage` de schema.org con las mismas preguntas y respuestas. */
export function faqJsonLd(items: FaqItem[]) {
  return {
    "@type": "FAQPage",
    mainEntity: items.map((it) => ({
      "@type": "Question",
      name: it.q,
      acceptedAnswer: { "@type": "Answer", text: it.a },
    })),
  };
}
