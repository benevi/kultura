# NOW

> Una sola tarea activa. Si no aparece aquí, no se trabaja en ello.

---

## NOW

**B3.5h-AUDIT-E2E-1 → ✅ CERRADO** (commit 723a91b)

**Siguiente:** B3.5h-AUDIT-E2E-2 — refactor de hallazgos del audit.
Orden propuesto:
1. E39 (puerto :3001, riesgo producción real).
2. E26 (selector frágil de chat-send).
3. E40 (falso verde "successful registration" auth.spec.ts:81).
4. E43 + vecinos (OR + .first() sistémico, 5 ocurrencias en 3 archivos).
5. E41 (Jikan mock para discover-pagination).
6. E42 (BASE redundante en auth.spec.ts).

Pendiente: revisar con humano si se acomete completo o se prioriza solo
E39 + E40 + E26 (los tres con valor de cobertura real).
