import { useEffect, useMemo, useState } from "react";

type Game = {
  id: string;
  starts_at: string;
  team_ids: string[];
  home_team: string;
  away_team: string;
  category: string;
  round: string;
  source_url: string;
};
type Conflict = {
  id: string;
  date: string;
  field_id: string;
  venue: string;
  town: string;
  gap_minutes: number;
  kind: "simultaneous" | "short_gap";
  matches: Game[];
  resolved: boolean;
  note: string;
  reviewed_at: string | null;
};
type ResponseData = {
  items: Conflict[];
  skipped_matches: number;
  minimum_minutes: number;
};
type Team = { id: string; name: string; categories: string };
const dateFormat = new Intl.DateTimeFormat("es-ES", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Europe/Madrid",
});
const timeFormat = new Intl.DateTimeFormat("es-ES", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Madrid",
});
const today = () =>
  new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

function ReviewCard({
  item,
  busy,
  onSave,
}: {
  item: Conflict;
  busy: boolean;
  onSave: (item: Conflict, resolved: boolean, note: string) => void;
}) {
  const [note, setNote] = useState(item.note);
  useEffect(() => setNote(item.note), [item.note]);
  return (
    <article className={`conflict-card ${item.resolved ? "reviewed" : ""}`}>
      <div className="conflict-heading">
        <div>
          <span className={`conflict-badge ${item.kind}`}>
            {item.kind === "simultaneous"
              ? "Misma hora"
              : `${item.gap_minutes} min entre partidos`}
          </span>
          <h3>{dateFormat.format(new Date(`${item.date}T12:00:00+01:00`))}</h3>
          <p>
            {item.venue} · {item.town}
          </p>
        </div>
        <span className={`review-status ${item.resolved ? "done" : ""}`}>
          {item.resolved ? "Resuelta" : "Pendiente"}
        </span>
      </div>
      <div className="conflict-games">
        {item.matches.map((m) => (
          <div className="conflict-game" key={m.id}>
            <time dateTime={m.starts_at}>
              {timeFormat.format(new Date(m.starts_at))}
            </time>
            <div>
              <strong>{m.home_team}</strong>
              <span>vs {m.away_team}</span>
              <small>
                {m.category} · Jornada {m.round}
              </small>
            </div>
            <a
              href={m.source_url}
              target="_blank"
              rel="noreferrer"
              aria-label={`Consultar partido ${m.id} en FBCV`}
            >
              FBCV ↗
            </a>
          </div>
        ))}
      </div>
      <div className="review-actions">
        <label htmlFor={`note-${item.id}`}>
          Nota de revisión <span>(opcional)</span>
        </label>
        <textarea
          id={`note-${item.id}`}
          rows={2}
          maxLength={1000}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Por ejemplo: se juega en dos pistas diferentes."
        />
        <div className="review-buttons">
          <small>
            {item.reviewed_at
              ? `Última revisión: ${dateFormat.format(new Date(item.reviewed_at))}`
              : "Separación mínima: 2 horas entre inicios."}
          </small>
          {note !== item.note && (
            <button
              disabled={busy}
              className="secondary-action"
              onClick={() => onSave(item, item.resolved, note)}
            >
              Guardar nota
            </button>
          )}
          <button
            disabled={busy}
            className={item.resolved ? "secondary-action" : "primary-action"}
            onClick={() => onSave(item, !item.resolved, note)}
          >
            {busy
              ? "Guardando…"
              : item.resolved
                ? "Reabrir incidencia"
                : "Marcar como resuelta"}
          </button>
        </div>
      </div>
    </article>
  );
}

export default function ConflictsPanel({
  clubId,
  clubName,
  teams,
}: {
  clubId: string;
  clubName: string;
  teams: Team[];
}) {
  const [data, setData] = useState<ResponseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [saving, setSaving] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [status, setStatus] = useState("pending");
  const [kind, setKind] = useState("all");
  const [team, setTeam] = useState("all");
  const [venue, setVenue] = useState("all");
  const [from, setFrom] = useState(today);
  const [until, setUntil] = useState("");
  const [page, setPage] = useState(1);
  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true);
    setError("");
    fetch(`/api/clubs/${clubId}/conflicts`, { signal: ctrl.signal })
      .then(async (r) => {
        if (!r.ok)
          throw new Error(
            "No se han podido cargar las incidencias. Vuelve a intentarlo.",
          );
        return r.json() as Promise<ResponseData>;
      })
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch((e) => {
        if (e.name !== "AbortError") {
          setError(e.message);
          setLoading(false);
        }
      });
    return () => ctrl.abort();
  }, [clubId, retry]);
  useEffect(() => setPage(1), [status, kind, team, venue, from, until]);
  const venues = useMemo(
    () =>
      Array.from(
        new Map(
          data?.items.map((c) => [
            c.field_id,
            { id: c.field_id, name: `${c.venue} · ${c.town}` },
          ]) || [],
        ).values(),
      ).sort((a, b) => a.name.localeCompare(b.name)),
    [data],
  );
  const filtered =
    data?.items.filter(
      (c) =>
        (status === "all" || c.resolved === (status === "resolved")) &&
        (kind === "all" || c.kind === kind) &&
        (team === "all" || c.matches.some((m) => m.team_ids.includes(team))) &&
        (venue === "all" || c.field_id === venue) &&
        (!from || c.date >= from) &&
        (!until || c.date <= until),
    ) || [];
  const pages = Math.max(1, Math.ceil(filtered.length / 15));
  const current = Math.min(page, pages);
  const pending = data?.items.filter((c) => !c.resolved).length || 0;
  async function save(item: Conflict, resolved: boolean, note: string) {
    setSaving(item.id);
    setError("");
    setNotice("");
    try {
      const response = await fetch(
        `/api/clubs/${clubId}/conflicts/${item.id}/review`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ resolved, note }),
        },
      );
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(
          body?.detail || "No se ha guardado la revisión. Vuelve a intentarlo.",
        );
      }
      const review = await response.json();
      setData((d) =>
        d
          ? {
              ...d,
              items: d.items.map((c) =>
                c.id === item.id ? { ...c, ...review } : c,
              ),
            }
          : d,
      );
      setNotice(
        resolved
          ? "Incidencia marcada como resuelta."
          : "Revisión guardada; la incidencia está pendiente.",
      );
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No se ha guardado la revisión.",
      );
    } finally {
      setSaving(null);
    }
  }
  return (
    <div className="conflicts-panel">
      <div className="panel-toolbar">
        <span className="section-label">REVISIÓN DE CALENDARIOS</span>
        <button
          className="text-action"
          disabled={loading || !!saving}
          onClick={() => setRetry((r) => r + 1)}
        >
          Actualizar lista
        </button>
      </div>
      <div className="conflicts-intro">
        <p className="eyebrow">{clubName}</p>
        <h2>Incompatibilidades</h2>
        <p>
          Revisa coincidencias entre equipos de tu club y guarda las que ya has
          comprobado.
        </p>
        <div className="review-explainer">
          <strong>Posibles conflictos de instalación</strong>
          <p>
            FBCV no distingue todas las pistas interiores. Dos partidos pueden
            compartir instalación y jugar en canchas diferentes. Marcarlos como
            resueltos guarda tu revisión; no cambia sus horarios.
          </p>
        </div>
      </div>
      {loading && (
        <p className="loading" role="status">
          Buscando coincidencias…
        </p>
      )}
      {error && (
        <div className="error" role="alert">
          <p>{error}</p>
          <button onClick={() => setRetry((r) => r + 1)}>
            Volver a cargar
          </button>
        </div>
      )}
      {notice && (
        <p className="review-notice" role="status">
          {notice}
        </p>
      )}
      {data && !loading && (
        <>
          <div className="review-summary">
            <span>
              <b>{pending}</b> pendientes
            </span>
            <span>
              <b>{data.items.length - pending}</b> resueltas
            </span>
            <small>
              Temporada completa · cada incidencia compara dos partidos
            </small>
          </div>
          <div className="conflict-filters">
            <label>
              Estado
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="pending">Pendientes</option>
                <option value="resolved">Resueltas</option>
                <option value="all">Todas</option>
              </select>
            </label>
            <label>
              Tipo
              <select value={kind} onChange={(e) => setKind(e.target.value)}>
                <option value="all">Todos los tipos</option>
                <option value="simultaneous">Misma hora</option>
                <option value="short_gap">Menos de 2 horas</option>
              </select>
            </label>
            <label>
              Equipo
              <select value={team} onChange={(e) => setTeam(e.target.value)}>
                <option value="all">Todos los equipos</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} · {t.categories}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Instalación
              <select value={venue} onChange={(e) => setVenue(e.target.value)}>
                <option value="all">Todas las instalaciones</option>
                {venues.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Desde
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </label>
            <label>
              Hasta
              <input
                type="date"
                value={until}
                onChange={(e) => setUntil(e.target.value)}
              />
            </label>
          </div>
          <div className="results-line">
            <p>{filtered.length} incidencias con estos filtros</p>
            <button
              className="text-action"
              onClick={() => {
                setStatus("all");
                setKind("all");
                setTeam("all");
                setVenue("all");
                setFrom("");
                setUntil("");
              }}
            >
              Ver toda la temporada
            </button>
          </div>
          {data.skipped_matches > 0 && (
            <p className="excluded-note">
              {data.skipped_matches} partidos no se han comparado por falta de
              instalación o de fecha/hora confirmada.
            </p>
          )}
          {from && until && from > until ? (
            <p className="review-empty">
              La fecha «Hasta» debe ser igual o posterior a «Desde».
            </p>
          ) : filtered.length === 0 ? (
            <p className="review-empty">
              No hay incidencias con estos filtros. Puedes consultar las
              resueltas o ampliar las fechas.
            </p>
          ) : (
            <div className="conflict-list">
              {filtered.slice((current - 1) * 15, current * 15).map((item) => (
                <ReviewCard
                  key={item.id}
                  item={item}
                  busy={saving === item.id}
                  onSave={save}
                />
              ))}
            </div>
          )}
          {pages > 1 && (
            <nav
              className="review-pagination"
              aria-label="Páginas de incidencias"
            >
              <button
                disabled={current === 1}
                onClick={() => setPage(current - 1)}
              >
                Anterior
              </button>
              <span>
                Página {current} de {pages}
              </span>
              <button
                disabled={current === pages}
                onClick={() => setPage(current + 1)}
              >
                Siguiente
              </button>
            </nav>
          )}
        </>
      )}
    </div>
  );
}
