# Puertas G0–G6

Fuente: plan §3 (tabla canónica). Aquí solo se operativiza. **Decide siempre Víctor.** G1, G3a, G3b y G4 los revisa antes un agente de Claude **distinto** del que implementó (`docs/gates/Gx-revision.md`). Cada acta usa [`plantillas/acta-puerta.md`](plantillas/acta-puerta.md) y se guarda como `docs/gates/Gx-acta-YYYY-MM-DD.md` (pendiente: el plan solo nombra `Gx-revision.md`; la ruta del acta es propuesta).

| Puerta | Cuándo | Métrica y umbral | Evidencia a guardar | Si falla | Bloquea |
|---|---|---|---|---|---|
| **G0 Legal** | Al llegar respuesta válida al encargo (enviado en 8A.0) | Respuesta escrita a P1, P2, P4, P7, P8, P14 (asesoría o permiso del proveedor). Cobertura por entradas **y** títulos únicos: ≥ 80 % GO; 50–80 % GO parcial; < 50 % NO-GO. Sin respuesta ⇒ NO-GO | `docs/legal/informe-G0.pdf` o cartas; salida de `docs/legal/g0-cobertura.sql`; filas de `provider_art_policy` con `evidence_path` | 8B.3 fuera; 3D con textura directa o carátula | 8B.3, S4 en producción, copia propia. **No 8A** |
| **G1 Rendimiento** | Fin de 8A.1 | S1+S3+S7+S10; 6 modelos; frame p95 ≤ 1,0 vsync; ningún frame > 50 ms; ≤ 1 % > 2 vsync; 0 pérdidas de contexto en 10 min; térmica ≤ 20 %; memoria T1 ≤ +150 MB, T2 ≤ +250 MB; bajada de tier probada a 30/60/120 Hz | `docs/spikes/S*.md` + trazas JSON; `docs/gates/G1-revision.md` | ≤ 25 % falla: solo T1 con ajustes; > 25 %: 8A entera 2D | Encender T1 |
| **G2 Canvas persistente** | Antes de 8B.1 | 0 reinicios público → (app) → ficha; CLS ≤ 0,05 en vuelo; 2D idéntico sin JS | `docs/spikes/S2.md` + E2E | 3D solo en ficha; 8B.1 fuera | 8B.1 |
| **G3a Rediseño 2D** | Fin de 8A.1 | Todas las tareas ≥ 4/5; sin bloqueo para la persona con lector; T2 y T4 en objetivo; P-9 cerrado | CSV + `docs/research/R1.md`; consentimientos; `G3a-revision.md` | Rehacer (máx. 2). Panel falla 2.ª vez ⇒ 2D solo, T1 fuera, G3b no se celebra | 8A.2 |
| **G3b T1 vs 2D** | En 8A.4, antes de `F8_FICHA_T1` | 4/5 entienden; 3/5 prefieren; ninguna tarea > 10 % más lenta; persona con lector completa todo | CSV + `docs/research/R2.md`; `G3b-revision.md` | Rehacer (máx. 2); 2 fallos: sin T1, sin 8B, sin V9 | T1, 8B, V9 |
| **G4 Valor en campo** | Desde 8A.4 al 100 %: mín. 8 sem o 150 sesiones 3D ponderadas (lo último); tope 12 sem ⇒ «direccional» | Retención y entradas por usuario activo **no bajan** (duro) + filas §8.5; < 20 sesiones/sem: mediana y máximo | `docs/metricas-fase8.sql`, export RUM, informe ≤ 1 pág., `G4-revision.md` | 3D opcional desactivado; reevaluar en G6 | 8B |
| **G5 Alcance** | Esfuerzo 8A.2–8A.4 > ≈ 21,5 sem (corregido 2026-11-13; antes ≈ 18) sin ficha nueva en producción | Primer PR de 8A.4 fusionado | Fecha de merge | Orden de recorte §5.7; T1 puede salir | Resto de 8A con 3D |
| **G6 Coste de oportunidad** | Al cerrar 8A.6 y cada trimestre | ≥ 12 activos a 30 días **y** entradas por activo ≥ línea base | Consulta G6 de `docs/metricas-fase8.sql` | 8B se aplaza un trimestre | 8B |

## Excepción documentada
- R15: si no hay persona con lector, Víctor hace los 9 flujos con NVDA + Firefox y VoiceOver iOS y se marca «riesgo aceptado» en el acta de G3a/G3b. Con 3 personas, resultado «direccional».
- G1 sin los 6 dispositivos: **pendiente** (ver [D1](decisiones-pendientes.md)).
