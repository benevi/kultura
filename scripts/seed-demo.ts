// ============================================================
// KULTURA — Datos de la cuenta demo (E-DEMO)
//
// Crea (o RESETEA, si ya existe) la cuenta demo de solo lectura y a sus amigos
// de ejemplo, y la rellena con títulos REALES del catálogo: biblioteca en los
// siete formatos, listas, grupos con publicaciones, amistades, una
// conversación y una recomendación pendiente. Es idempotente: se puede volver
// a lanzar para refrescar el catálogo de la demo.
//
// Uso (desde la raíz del proyecto, con las claves en .env.local):
//   npx tsx --env-file=.env.local scripts/seed-demo.ts
//
// Necesita: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY y las claves
// de los proveedores (TMDB_API_KEY, RAWG_API_KEY…). DEMO_USER_EMAIL es
// opcional (por defecto demo@kultura-demo.example); el MISMO valor tiene que ir
// en las variables de entorno de Vercel para que aparezca "Ver la demo".
//
// Los emails son de `.example` (dominio reservado, nadie puede recibir correo
// ahí). Importa: el cambio de email de Supabase exige confirmar en la dirección
// ANTIGUA, así que nadie puede quedarse con la cuenta demo cambiándole el email.
// ============================================================

import { createClient } from "@supabase/supabase-js";
import { fetchDiscoverData } from "@/lib/api/discover";
import type { MediaItem, MediaType } from "@/types/media";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DEMO_EMAIL = process.env.DEMO_USER_EMAIL || "demo@kultura-demo.example";

if (!url || !serviceKey) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY (¿--env-file=.env.local?)");
  process.exit(1);
}

const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

interface Person {
  email: string;
  username: string;
  /** Hex: `Avatar` pinta `avatar_color` tal cual como color CSS. */
  color: string;
  bio: string;
}

const DEMO: Person = {
  email: DEMO_EMAIL,
  username: "demo",
  color: "#ef4444",
  bio: "Cuenta de ejemplo de Kultura. Mira todo lo que quieras 👀",
};

const FRIENDS: Person[] = [
  { email: "lucia@kultura-demo.example", username: "lucia_lee", color: "#a855f7", bio: "Anime, manga y cualquier cosa de Ghibli." },
  { email: "marcos@kultura-demo.example", username: "marcos_play", color: "#3b82f6", bio: "Si tiene mando, lo juego." },
  { email: "irene@kultura-demo.example", username: "irene_pages", color: "#f59e0b", bio: "Club de lectura los jueves 📚" },
];

const FAMILIES: MediaType[] = ["movie", "tv", "anime", "manga", "game", "book", "comic"];
const STATUSES = ["completed", "in_progress", "pending", "completed", "abandoned", "completed"] as const;

function check<T>(label: string, res: { data: T; error: { message: string } | null }): NonNullable<T> {
  if (res.error) throw new Error(`${label}: ${res.error.message}`);
  // Un delete/insert sin `.select()` devuelve data null: se normaliza a [].
  return (res.data ?? []) as NonNullable<T>;
}

async function findOrCreate(person: Person): Promise<string> {
  // listUsers pagina; la demo vive en un proyecto pequeño, pero se recorre
  // entero para no crear un duplicado si hay más de una página.
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(`listUsers: ${error.message}`);
    const found = data.users.find((u) => u.email === person.email);
    if (found) {
      await admin.auth.admin.updateUserById(found.id, { app_metadata: { demo: true } });
      return found.id;
    }
    if (data.users.length < 200) break;
  }
  const { data, error } = await admin.auth.admin.createUser({
    email: person.email,
    email_confirm: true,
    app_metadata: { demo: true },
  });
  if (error || !data.user) throw new Error(`createUser ${person.email}: ${error?.message}`);
  return data.user.id;
}

async function catalog(): Promise<Record<MediaType, MediaItem[]>> {
  const out = {} as Record<MediaType, MediaItem[]>;
  for (const type of FAMILIES) {
    try {
      const { items } = await fetchDiscoverData(type, 1, {}, "es");
      out[type] = items.filter((i) => i.poster).slice(0, 12);
    } catch (e) {
      console.warn(`  [aviso] ${type}: ${(e as Error).message}`);
      out[type] = [];
    }
    console.log(`  ${type}: ${out[type].length} títulos`);
  }
  return out;
}

function mediaRow(item: MediaItem) {
  return {
    id: item.id,
    external_id: item.externalId,
    type: item.type,
    title: item.title,
    poster: item.poster ?? null,
    backdrop: item.backdrop ?? null,
    year: item.year ?? null,
    synopsis: item.synopsis ?? null,
    metadata: { genres: item.genres ?? [] },
  };
}

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();

async function main() {
  console.log("Usuarios…");
  const demoId = await findOrCreate(DEMO);
  const friendIds = await Promise.all(FRIENDS.map(findOrCreate));
  const everyone = [demoId, ...friendIds];
  const people = [DEMO, ...FRIENDS];

  check(
    "users",
    await admin.from("users").upsert(
      everyone.map((id, i) => ({
        id,
        username: people[i].username,
        avatar_color: people[i].color,
        avatar_initials: people[i].username.slice(0, 2).toUpperCase(),
        bio: people[i].bio,
        preferred_locale: "es",
      })),
      { onConflict: "id" }
    )
  );

  console.log("Limpiando datos anteriores de la demo…");
  // Orden: primero lo que cuelga de otras filas.
  const ownedLists = check("lists", await admin.from("lists").select("id").in("owner_id", everyone)) ?? [];
  const ownedGroups = check("groups", await admin.from("groups").select("id").in("owner_id", everyone)) ?? [];
  const convs =
    check("conv", await admin.from("conversation_members").select("conversation_id").in("user_id", everyone)) ?? [];
  const listIds = ownedLists.map((l) => l.id);
  const groupIds = ownedGroups.map((g) => g.id);
  const convIds = Array.from(new Set(convs.map((c) => c.conversation_id)));
  if (listIds.length) {
    check("list_items", await admin.from("list_items").delete().in("list_id", listIds));
    check("list_members", await admin.from("list_members").delete().in("list_id", listIds));
    check("lists", await admin.from("lists").delete().in("id", listIds));
  }
  if (groupIds.length) {
    check("group_posts", await admin.from("group_posts").delete().in("group_id", groupIds));
    check("group_invitations", await admin.from("group_invitations").delete().in("group_id", groupIds));
    check("group_members", await admin.from("group_members").delete().in("group_id", groupIds));
    check("groups", await admin.from("groups").delete().in("id", groupIds));
  }
  if (convIds.length) {
    check("messages", await admin.from("messages").delete().in("conversation_id", convIds));
    check("conversation_members", await admin.from("conversation_members").delete().in("conversation_id", convIds));
    check("conversations", await admin.from("conversations").delete().in("id", convIds));
  }
  check("user_media", await admin.from("user_media").delete().in("user_id", everyone));
  check("notifications", await admin.from("notifications").delete().in("user_id", everyone));
  check("recommendations", await admin.from("recommendations").delete().in("to_user_id", everyone));
  check("friendships", await admin.from("friendships").delete().in("requester_id", everyone));
  check("friendships", await admin.from("friendships").delete().in("receiver_id", everyone));

  console.log("Catálogo real…");
  const byType = await catalog();
  const all = FAMILIES.flatMap((t) => byType[t]);
  if (all.length < 10) throw new Error("El catálogo ha devuelto muy pocos títulos; revisa las claves de los proveedores.");
  check("media", await admin.from("media").upsert(all.map(mediaRow), { onConflict: "id" }));

  console.log("Bibliotecas…");
  const library: Record<string, unknown>[] = [];
  FAMILIES.forEach((type) => {
    byType[type].slice(0, 6).forEach((item, i) => {
      const status = STATUSES[i];
      library.push({
        user_id: demoId,
        media_id: item.id,
        status,
        score: status === "completed" ? 3 + (i % 3) : null,
        created_at: daysAgo(i * 5 + FAMILIES.indexOf(type)),
      });
    });
  });
  // Cada amigo con su sesgo, y parte en común con la demo (el "popular en tu
  // círculo" y las coincidencias necesitan solapamiento).
  const taste: MediaType[][] = [["anime", "manga", "movie"], ["game", "tv", "comic"], ["book", "movie", "tv"]];
  friendIds.forEach((fid, f) => {
    taste[f].forEach((type) => {
      byType[type].slice(2, 10).forEach((item, i) => {
        library.push({
          user_id: fid,
          media_id: item.id,
          status: i % 3 === 0 ? "in_progress" : "completed",
          score: i % 3 === 0 ? null : 4 + (i % 2),
          created_at: daysAgo(i * 2 + f),
        });
      });
    });
  });
  check("user_media", await admin.from("user_media").insert(library));

  console.log("Amistades…");
  check(
    "friendships",
    await admin
      .from("friendships")
      .insert(friendIds.map((fid, i) => ({ requester_id: fid, receiver_id: demoId, status: "accepted", created_at: daysAgo(40 - i) })))
  );

  console.log("Listas…");
  const lists = check(
    "lists",
    await admin
      .from("lists")
      .insert([
        { owner_id: demoId, name: "Pelis para el finde 🍿", media_type: "movie", is_collaborative: true, created_at: daysAgo(20) },
        { owner_id: demoId, name: "Anime imprescindible", media_type: "anime", is_collaborative: false, created_at: daysAgo(15) },
        { owner_id: demoId, name: "Pendientes de leer 📚", media_type: "book", is_collaborative: false, created_at: daysAgo(9) },
      ])
      .select("id, name")
  );
  const [weekend, anime, reading] = lists;
  check("list_members", await admin.from("list_members").insert([{ list_id: weekend.id, user_id: friendIds[0] }]));
  const items = [
    ...byType.movie.slice(6, 11).map((m, i) => ({
      list_id: weekend.id,
      media_id: m.id,
      added_by: i % 2 ? friendIds[0] : demoId,
    })),
    ...byType.anime.slice(0, 6).map((m) => ({ list_id: anime.id, media_id: m.id, added_by: demoId })),
    ...byType.book.slice(6, 11).map((m) => ({
      list_id: reading.id,
      media_id: m.id,
      added_by: demoId,
    })),
  ];
  check("list_items", await admin.from("list_items").insert(items));

  console.log("Grupos…");
  const groups = check(
    "groups",
    await admin
      .from("groups")
      .insert([
        { owner_id: friendIds[0], name: "Noches de anime", description: "Un capítulo cada martes y luego debate.", cover_color: "#a855f7", is_public: true, created_at: daysAgo(30) },
        { owner_id: friendIds[2], name: "Club de lectura", description: "Un libro al mes. Sin spoilers antes del jueves.", cover_color: "#f59e0b", is_public: true, created_at: daysAgo(25) },
      ])
      .select("id")
  );
  check(
    "group_members",
    await admin.from("group_members").insert([
      { group_id: groups[0].id, user_id: friendIds[0], role: "owner" },
      { group_id: groups[0].id, user_id: demoId, role: "member" },
      { group_id: groups[0].id, user_id: friendIds[1], role: "member" },
      { group_id: groups[1].id, user_id: friendIds[2], role: "owner" },
      { group_id: groups[1].id, user_id: demoId, role: "member" },
    ])
  );
  check(
    "group_posts",
    await admin.from("group_posts").insert([
      { group_id: groups[0].id, user_id: friendIds[0], content: "Esta semana toca el siguiente capítulo. ¿Martes a las 21:00?", media_id: byType.anime[0]?.id ?? null, created_at: daysAgo(3) },
      { group_id: groups[0].id, user_id: demoId, content: "¡Me apunto! Llevo toda la semana esperando.", media_id: null, created_at: daysAgo(2) },
      { group_id: groups[0].id, user_id: friendIds[1], content: "Yo llego tarde, empezad sin mí 🙏", media_id: null, created_at: daysAgo(2) },
      { group_id: groups[1].id, user_id: friendIds[2], content: "Libro de este mes 👇 Quedamos el último jueves.", media_id: byType.book[0]?.id ?? null, created_at: daysAgo(6) },
      { group_id: groups[1].id, user_id: demoId, content: "Voy por la mitad y no puedo soltarlo.", media_id: null, created_at: daysAgo(1) },
    ])
  );

  console.log("Chat…");
  const [conv] = check(
    "conversations",
    await admin.from("conversations").insert({ last_message_at: daysAgo(0) }).select("id")
  );
  check(
    "conversation_members",
    await admin.from("conversation_members").insert([
      { conversation_id: conv.id, user_id: demoId, last_read_at: daysAgo(0) },
      { conversation_id: conv.id, user_id: friendIds[0], last_read_at: daysAgo(0) },
    ])
  );
  const film = byType.movie[0]?.title ?? "la peli";
  check(
    "messages",
    await admin.from("messages").insert([
      { conversation_id: conv.id, sender_id: friendIds[0], content: `¿Viste ya ${film}?`, created_at: daysAgo(1) },
      { conversation_id: conv.id, sender_id: demoId, content: "Sí, el sábado. Me encantó el final.", created_at: daysAgo(1) },
      { conversation_id: conv.id, sender_id: friendIds[0], content: "Te la añadí a la lista del finde por si alguien más se anima 😄", created_at: daysAgo(0) },
    ])
  );

  console.log("Recomendación y notificación…");
  const rec = byType.manga[0] ?? byType.anime[1];
  if (rec) {
    const [row] = check(
      "recommendations",
      await admin
        .from("recommendations")
        .insert({ from_user_id: friendIds[0], to_user_id: demoId, media_id: rec.id, message: "Este te va a gustar, hazme caso." })
        .select("id")
    );
    check(
      "notifications",
      await admin.from("notifications").insert({
        user_id: demoId,
        type: "recommendation",
        payload: {
          recommendationId: row.id,
          fromUserId: friendIds[0],
          fromUsername: FRIENDS[0].username,
          mediaId: rec.id,
          mediaTitle: rec.title,
          message: "Este te va a gustar, hazme caso.",
        },
      })
    );
  }

  console.log(`\nListo. Cuenta demo: ${DEMO_EMAIL}`);
  console.log("Pon ese email en Vercel como DEMO_USER_EMAIL (Production y Preview) y vuelve a desplegar.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
