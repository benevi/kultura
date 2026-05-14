# NOW

> Una sola tarea activa. Si no aparece aquí, no se trabaja en ello.

---

## NOW

**B3.5h-AUDIT-E2E-4 → ✅ CERRADO** (commits pendientes de hash — ver DONE.md)

**Resultado E2E:** 32 passed / 2 failed (baseline: 24/10).
- 8 rojos de discover-pagination → verdes ✅ (Fix H2: login en beforeEach)
- 2 rojos de successful registration → rojo legítimo documentado en `docs/TEST_EXCEPTIONS.md` (Caso C: rate-limit global Supabase free tier en suite paralela)

**Siguiente:** Decidir con humano entre:
1. **E40-definitivo** — Fix real del rate-limit en E40: aumentar límite en kultura-test Dashboard → Authentication → Rate Limits, luego re-ejecutar E2E y verificar que llega a 34/34.
2. **B3.5e-3-prod** — Gate E2E contra producción.
3. **B4** — Bloque 4 (producción real). Requiere A–D cerrado.
4. **E44** — Investigar Vercel auto-promote.

Pendiente: promoción manual del último deploy a Production: Current (E44 vigente).
