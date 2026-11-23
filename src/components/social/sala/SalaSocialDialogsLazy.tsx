"use client";

import dynamic from "next/dynamic";

/**
 * Los diálogos de «Sala» de la ficha (F2d: añadir a una lista y recomendar)
 * por `next/dynamic`, como `SalaButtonLazy`: con la bandera `SALA_FICHA`
 * apagada no se pintan nunca y su código (`SalaDialog`, los campos de «Sala»)
 * no se descarga. Con ella encendida, el componente se pinta cerrado desde el
 * principio, así que su código ya está al abrirlo.
 *
 * El de denunciar va aparte (`SalaReportDialogLazy`): `ReportButton` se usa
 * también en el chat, los grupos y el perfil público, y con un archivo común
 * arrastraría los textos de listas y recomendar a esas páginas (REN-5).
 *
 * Al retirar la ficha vieja (F6), quien los usa puede importarlos directos.
 */
export const SalaAddToListDialogLazy = dynamic(() => import("./SalaAddToListDialog").then((m) => m.SalaAddToListDialog));
export const SalaRecommendDialogLazy = dynamic(() => import("./SalaRecommendDialog").then((m) => m.SalaRecommendDialog));
