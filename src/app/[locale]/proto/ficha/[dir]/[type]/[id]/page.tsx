// Prototipo fase 8.3 — una ficha en una dirección: /[locale]/proto/ficha/{a|b|c}/{type}/{id}
// La base pone el contenedor (tema, movimiento, barra), los datos reales y el
// color de la portada; la dirección pone composición y estilo.

import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { CoverColor } from "../../../_base/CoverColor";
import { cjkFontClassName } from "../../../_base/fonts";
import { loadProtoFicha } from "../../../_base/load";
import { ProtoShell } from "../../../_base/ProtoShell";
import { isDir } from "../../../_base/works";
import { DIRECTIONS } from "../../../_dirs/registry";

interface Props {
  params: Promise<{ locale: string; dir: string; type: string; id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, dir, type, id } = await params;
  const data = isDir(dir) ? await loadProtoFicha(type, id, locale) : null;
  return { title: data ? `${data.title} · ${dir.toUpperCase()} · prototipo` : "Prototipo" };
}

export default async function ProtoFichaPage({ params }: Props) {
  const { locale, dir, type, id } = await params;
  if (!isDir(dir)) notFound();
  const data = await loadProtoFicha(type, id, locale);
  if (!data) notFound();
  const { Ficha, fontClassName } = DIRECTIONS[dir];
  return (
    <ProtoShell locale={locale} current={{ dir, type, id }} fontClassName={`${cjkFontClassName} ${fontClassName}`}>
      <CoverColor cover={data.cover} />
      <Ficha data={data} />
    </ProtoShell>
  );
}
