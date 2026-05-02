# AUDIT — KULTURA

> La auditoría tech-DD original (2026-04-23) fue archivada en
> [`docs/_archive/AUDIT_2026-04-23.md`](docs/_archive/AUDIT_2026-04-23.md)
> porque parte de su contenido quedó obsoleto: afirmaba "sin metadata
> dinámica" (falso, hay `generateMetadata` en varias páginas), "0
> archivos `*.test.tsx`" (falso desde A5.11), y "console.error en 15
> instancias" (actualmente 17). Se conserva como referencia histórica.
>
> **Fuente de verdad actual:** [`ESTADO_PROYECTO.md`](ESTADO_PROYECTO.md)
> (auditoría integral 2026-05-02, leyendo el código real).
>
> **Plan operativo:** [`docs/BACKLOG.md`](docs/BACKLOG.md) — bloques A-F,
> tarea activa en [`docs/NOW.md`](docs/NOW.md).

## Gaps de producción aún abiertos

Resumen de [`ESTADO_PROYECTO.md` §18.1](ESTADO_PROYECTO.md):

| Gap | Tarea backlog |
|-----|---------------|
| Migraciones SQL versionadas — schema solo en dashboard remoto | B2 / B2-DOC / B2-VERIFY |
| Rate limiting distribuido (multi-instancia Vercel) | C3 |
| Observabilidad de producción (Sentry + logger estructurado) | C1, C2 |
| GDPR — política de privacidad y términos | D1 |
| Eliminación / exportación de cuenta | D2, D3 |
| Auditoría del backup `kultura-backup-2026-05-01.zip` (~280 MB) | B4 |
