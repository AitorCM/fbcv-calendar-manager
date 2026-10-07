type PayloadRow = { payload: string };
type Review = {
  conflict_id: string;
  resolved: number;
  note: string;
  reviewed_at: string;
};
type Game = { starts_at: string };
type Conflict = {
  id: string;
  resolved: boolean;
  note: string;
  reviewed_at: string | null;
  date: string;
  matches: Game[];
};
function json(value: unknown, status = 200) {
  return Response.json(value, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
const fold = (s: string) =>
  s.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase();
async function api(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const season = url.searchParams.get("season") || "2026";
  if (!/^\d{4}$/.test(season))
    return json({ detail: "Temporada no válida." }, 422);
  const active = await env.DB.prepare(
    "SELECT snapshot_id FROM cf_active_snapshot WHERE season=?",
  )
    .bind(season)
    .first<{ snapshot_id: string }>();
  if (!active)
    return json(
      { detail: "No hay calendarios publicados para esta temporada." },
      503,
    );
  const snapshot = active.snapshot_id;
  if (request.method === "GET" && url.pathname === "/api/meta") {
    const row = await env.DB.prepare(
      "SELECT metadata FROM cf_snapshots WHERE id=?",
    )
      .bind(snapshot)
      .first<{ metadata: string }>();
    return row
      ? json(JSON.parse(row.metadata))
      : json({ detail: "Extracción no disponible." }, 503);
  }
  if (request.method === "GET" && url.pathname === "/api/clubs") {
    const q = url.searchParams.get("q") || "";
    if (q.length > 100)
      return json({ detail: "Búsqueda demasiado larga." }, 422);
    const rows = await env.DB.prepare(
      "SELECT id,name,team_count FROM cf_clubs WHERE snapshot_id=? AND instr(search_name,?)>0 ORDER BY search_name,id",
    )
      .bind(snapshot, fold(q))
      .all();
    return json(rows.results);
  }
  const teams = url.pathname.match(/^\/api\/clubs\/([^/]+)\/teams$/);
  if (request.method === "GET" && teams) {
    const rows = await env.DB.prepare(
      "SELECT payload FROM cf_teams WHERE snapshot_id=? AND club_id=? ORDER BY id",
    )
      .bind(snapshot, teams[1])
      .all<PayloadRow>();
    return json(rows.results.map((r) => JSON.parse(r.payload)));
  }
  const calendar = url.pathname.match(
    /^\/api\/clubs\/([^/]+)\/teams\/([^/]+)\/calendar$/,
  );
  if (request.method === "GET" && calendar) {
    const row = await env.DB.prepare(
      "SELECT payload FROM cf_calendars WHERE snapshot_id=? AND club_id=? AND team_id=?",
    )
      .bind(snapshot, calendar[1], calendar[2])
      .first<PayloadRow>();
    return row
      ? json(JSON.parse(row.payload))
      : json(
          {
            detail: "Este equipo no tiene calendario en el club seleccionado.",
          },
          404,
        );
  }
  const conflicts = url.pathname.match(/^\/api\/clubs\/([^/]+)\/conflicts$/);
  if (request.method === "GET" && conflicts) {
    const club = conflicts[1];
    const [rows, reviews, meta] = await Promise.all([
      env.DB.prepare(
        "SELECT payload FROM cf_conflicts WHERE snapshot_id=? AND club_id=?",
      )
        .bind(snapshot, club)
        .all<PayloadRow>(),
      env.DB.prepare(
        "SELECT conflict_id,resolved,note,reviewed_at FROM conflict_reviews WHERE season=? AND club_id=?",
      )
        .bind(season, club)
        .all<Review>(),
      env.DB.prepare(
        "SELECT skipped_matches FROM cf_conflict_meta WHERE snapshot_id=? AND club_id=?",
      )
        .bind(snapshot, club)
        .first<{ skipped_matches: number }>(),
    ]);
    const saved = new Map(reviews.results.map((r) => [r.conflict_id, r]));
    const items = rows.results.map((row) => {
      const item: Conflict = JSON.parse(row.payload);
      const review = saved.get(item.id);
      return review
        ? {
            ...item,
            resolved: !!review.resolved,
            note: review.note,
            reviewed_at: review.reviewed_at,
          }
        : item;
    });
    // The snapshot exporter preserves the same chronological ordering as the local API.
    items.sort(
      (a, b) =>
        String(a.date).localeCompare(String(b.date)) ||
        String(a.matches[0].starts_at).localeCompare(
          String(b.matches[0].starts_at),
        ) ||
        a.id.localeCompare(b.id),
    );
    return json({
      items,
      skipped_matches: meta?.skipped_matches || 0,
      minimum_minutes: 120,
    });
  }
  const review = url.pathname.match(
    /^\/api\/clubs\/([^/]+)\/conflicts\/([a-f0-9]{64})\/review$/,
  );
  if (request.method === "PUT" && review) {
    if (
      request.headers.get("Origin") &&
      request.headers.get("Origin") !== url.origin
    )
      return json({ detail: "Origen no permitido." }, 403);
    if (!request.headers.get("Content-Type")?.startsWith("application/json"))
      return json({ detail: "Se requiere JSON." }, 415);
    if (Number(request.headers.get("Content-Length") || 0) > 8192)
      return json({ detail: "Revisión demasiado larga." }, 413);
    const reader = request.body?.getReader();
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > 8192) {
          await reader.cancel();
          return json({ detail: "Revisión demasiado larga." }, 413);
        }
        chunks.push(value);
      }
    }
    const buffer = new Uint8Array(bytes);
    let offset = 0;
    for (const chunk of chunks) {
      buffer.set(chunk, offset);
      offset += chunk.byteLength;
    }
    const raw = new TextDecoder().decode(buffer);
    if (raw.length > 8192)
      return json({ detail: "Revisión demasiado larga." }, 413);
    let body: unknown;
    try {
      body = JSON.parse(raw);
    } catch {
      return json({ detail: "JSON no válido." }, 422);
    }
    if (
      !body ||
      typeof body !== "object" ||
      !("resolved" in body) ||
      typeof body.resolved !== "boolean"
    )
      return json({ detail: "El estado debe ser verdadero o falso." }, 422);
    const note = "note" in body ? body.note : "";
    if (typeof note !== "string" || note.length > 1000)
      return json({ detail: "La nota admite hasta 1000 caracteres." }, 422);
    const exists = await env.DB.prepare(
      "SELECT id FROM cf_conflicts WHERE snapshot_id=? AND club_id=? AND id=?",
    )
      .bind(snapshot, review[1], review[2])
      .first();
    if (!exists)
      return json(
        {
          detail:
            "La incidencia ya no existe con este horario. Actualiza la lista.",
        },
        404,
      );
    const stamp = new Date().toISOString();
    await env.DB.prepare(
      "INSERT INTO conflict_reviews VALUES(?,?,?,?,?,?) ON CONFLICT(season,club_id,conflict_id) DO UPDATE SET resolved=excluded.resolved,note=excluded.note,reviewed_at=excluded.reviewed_at",
    )
      .bind(
        season,
        review[1],
        review[2],
        Number(body.resolved),
        note.trim(),
        stamp,
      )
      .run();
    return json({
      id: review[2],
      resolved: body.resolved,
      note: note.trim(),
      reviewed_at: stamp,
    });
  }
  return json({ detail: "Ruta no disponible." }, 404);
}
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/api/")) return env.ASSETS.fetch(request);
    try {
      return await api(request, env);
    } catch (error) {
      console.error(
        JSON.stringify({
          event: "api_error",
          path: url.pathname,
          error: error instanceof Error ? error.message : String(error),
        }),
      );
      return json(
        { detail: "No se han podido cargar los datos. Vuelve a intentarlo." },
        500,
      );
    }
  },
} satisfies ExportedHandler<Env>;
