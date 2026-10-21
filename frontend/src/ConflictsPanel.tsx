import { useEffect, useMemo, useState } from "react";
import SevenSeg from "./SevenSeg";
import { Icon } from "./Icon";
import { ErrorPanel, SkeletonRows } from "./states";

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

const groupFormat = new Intl.DateTimeFormat("es-ES", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "Europe/Madrid",
});
const PAGE_SIZE = 40;

function ConflictRow({
  item,
  busy,
  onSave,
}: {
  item: Conflict;
  busy: boolean;
  onSave: (item: Conflict, resolved: boolean, note: string) => void;
}) {
  const [note, setNote] = useState(item.note);
  const [editing, setEditing] = useState(false);
  useEffect(() => setNote(item.note), [item.note]);
  const showNote = editing || note !== item.note;
  return (
    <li className={`conflict-row${item.resolved ? " is-resolved" : ""}`}>
      <ul className="conflict-games">
        {item.matches.map((m) => (
          <li key={m.id}>
            <div className="time-tile tile-sm">
              <SevenSeg
                value={timeFormat.format(new Date(m.starts_at))}
                label={timeFormat.format(new Date(m.starts_at))}
                size="sm"
              />
            </div>
            <div className="conflict-game-main">
              <strong>
                {m.home_team} <span>–</span> {m.away_team}
              </strong>
              <small>
                {m.category} · Jornada {m.round}
              </small>
            </div>
            <a
              className="icon-button ghost"
              href={m.source_url}
              target="_blank"
              rel="noreferrer"
              aria-label={`Consultar partido ${m.id} en FBCV`}
              title="Ver en FBCV"
            >
              <Icon name="external" />
            </a>
          </li>
        ))}
      </ul>
      <div className="conflict-side">
        <span className={`conflict-kind${item.kind === "simultaneous" ? " is-strong" : ""}`}>
          <Icon name="clock" />
          {item.kind === "simultaneous"
            ? "Misma hora"
            : `${item.gap_minutes} min entre inicios`}
        </span>
        {item.resolved && (
          <span className="conflict-state">
            <Icon name="check" />
            Resuelta
            {item.reviewed_at && (
              <small> el {dateFormat.format(new Date(item.reviewed_at))}</small>
            )}
          </span>
        )}
        {item.note && !showNote && (
          <button className="conflict-note" onClick={() => setEditing(true)}>
            <Icon name="note" />
            <span>{item.note}</span>
          </button>
        )}
        <div className="conflict-actions">
          {!item.note && !showNote && (
            <button
              className="icon-button raised"
              aria-label="Añadir nota"
              title="Añadir nota"
              onClick={() => setEditing(true)}
            >
              <Icon name="note" />
            </button>
          )}
          <button
            disabled={busy}
            className={`resolve-button${item.resolved ? " is-on" : ""}`}
            aria-pressed={item.resolved}
            onClick={() => onSave(item, !item.resolved, note)}
          >
            <Icon name={item.resolved ? "refresh" : "check"} />
            {busy ? "Guardando…" : item.resolved ? "Reabrir" : "Resolver"}
          </button>
        </div>
      </div>
      {showNote && (
        <div className="review-form">
          <label htmlFor={`note-${item.id}`}>
            Nota de revisión <span>(opcional)</span>
          </label>
          <textarea
            id={`note-${item.id}`}
            rows={2}
            maxLength={1000}
            value={note}
            autoFocus
            onChange={(e) => setNote(e.target.value)}
            placeholder="Por ejemplo: se juega en dos pistas diferentes."
          />
          <div className="review-buttons">
            <button
              className="button secondary"
              disabled={busy}
              onClick={() => {
                setNote(item.note);
                setEditing(false);
              }}
            >
              Cancelar
            </button>
            <button
              disabled={busy || note === item.note}
              className="button secondary"
              onClick={() => {
                onSave(item, item.resolved, note);
                setEditing(false);
              }}
            >
              Guardar nota
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

function groupBySlot(items: Conflict[]) {
  const groups = new Map<
    string,
    { key: string; date: string; venue: string; town: string; items: Conflict[] }
  >();
  for (const item of items) {
    const key = `${item.date}|${item.field_id}`;
    if (!groups.has(key))
      groups.set(key, {
        key,
        date: item.date,
        venue: item.venue,
        town: item.town,
        items: [],
      });
    groups.get(key)!.items.push(item);
  }
  return [...groups.values()];
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
  const [filtersOpen, setFiltersOpen] = useState(false);
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
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), 4000);
    return () => clearTimeout(t);
  }, [notice]);
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
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
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
  const extraFilters = [
    kind !== "all",
    team !== "all",
    venue !== "all",
    from !== today(),
    !!until,
  ].filter(Boolean).length;
  const filtersActive =
    status !== "pending" || kind !== "all" || team !== "all" || venue !== "all" || from !== today() || !!until;
  return (
    <div className="view conflicts">
      <div className="toolbar">
        <div>
          <h2 className="view-title">Incompatibilidades</h2>
          <p className="view-meta">
            Partidos de {clubName} en la misma instalación a la misma hora o
            con menos de {Math.round((data?.minimum_minutes ?? 120) / 60)} horas
            entre inicios.
          </p>
        </div>
        <div className="toolbar-controls">
          <button
            className="button secondary"
            disabled={loading || !!saving}
            onClick={() => setRetry((r) => r + 1)}
          >
            <Icon name="refresh" />
            Actualizar
          </button>
        </div>
      </div>
      <p className="explainer">
        <Icon name="alert" />
        <span>
          La FBCV no distingue las pistas de una misma instalación: dos partidos
          pueden coincidir y jugarse en canchas distintas. Marcar una
          incidencia como resuelta guarda tu revisión para todo el club; no
          cambia ningún horario.
        </span>
      </p>
      {error && (
        <ErrorPanel
          message={error}
          onRetry={() => setRetry((r) => r + 1)}
          action="Volver a cargar"
        />
      )}
      {notice && (
        <p className="toast" role="status">
          <Icon name="check" />
          {notice}
        </p>
      )}
      {loading && <SkeletonRows count={4} />}
      {data && !loading && (
        <>
          <div className="filter-bar">
            <div className="segmented" role="group" aria-label="Estado">
              {(
                [
                  ["pending", `Pendientes · ${pending}`],
                  ["resolved", `Resueltas · ${data.items.length - pending}`],
                  ["all", `Todas · ${data.items.length}`],
                ] as const
              ).map(([value, text]) => (
                <button
                  key={value}
                  aria-pressed={status === value}
                  onClick={() => setStatus(value)}
                >
                  {text}
                </button>
              ))}
            </div>
            <button
              className="button secondary filters-toggle"
              aria-expanded={filtersOpen}
              aria-controls="conflict-filters"
              onClick={() => setFiltersOpen(!filtersOpen)}
            >
              Filtros
              {extraFilters > 0 && <span className="count-badge">{extraFilters}</span>}
              <Icon name="chevron-down" />
            </button>
            <div
              id="conflict-filters"
              className={`filter-fields${filtersOpen ? " is-open" : ""}`}
            >
              <label>
                <span>Tipo</span>
                <select value={kind} onChange={(e) => setKind(e.target.value)}>
                  <option value="all">Todos</option>
                  <option value="simultaneous">Misma hora</option>
                  <option value="short_gap">Menos de 2 horas</option>
                </select>
              </label>
              <label>
                <span>Equipo</span>
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
                <span>Instalación</span>
                <select value={venue} onChange={(e) => setVenue(e.target.value)}>
                  <option value="all">Todas</option>
                  {venues.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Desde</span>
                <input
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                />
              </label>
              <label>
                <span>Hasta</span>
                <input
                  type="date"
                  value={until}
                  onChange={(e) => setUntil(e.target.value)}
                />
              </label>
            </div>
          </div>
          <div className="results-line">
            <p>
              <b>{filtered.length}</b>{" "}
              {filtered.length === 1 ? "incidencia" : "incidencias"}
              {data.skipped_matches > 0 && (
                <span>
                  {" "}
                  · {data.skipped_matches}{" "}
                  {data.skipped_matches === 1
                    ? "partido sin instalación u hora confirmada no se compara"
                    : "partidos sin instalación u hora confirmada no se comparan"}
                </span>
              )}
            </p>
            {filtersActive && (
              <button
                className="text-button"
                onClick={() => {
                  setStatus("pending");
                  setKind("all");
                  setTeam("all");
                  setVenue("all");
                  setFrom(today());
                  setUntil("");
                }}
              >
                Quitar filtros
              </button>
            )}
          </div>
          {from && until && from > until ? (
            <p className="empty-note boxed">
              La fecha «Hasta» debe ser igual o posterior a «Desde».
            </p>
          ) : filtered.length === 0 ? (
            <div className="empty-panel">
              <Icon name="check" />
              <h3>
                {status === "pending" && pending === 0
                  ? "Todo revisado"
                  : "Sin incidencias con estos filtros"}
              </h3>
              <p>
                {status === "pending" && pending === 0
                  ? "No queda ninguna incompatibilidad pendiente en el club."
                  : "Prueba a consultar las resueltas o a ampliar las fechas."}
              </p>
              {status !== "all" && (
                <button
                  className="button secondary"
                  onClick={() => {
                    setStatus("all");
                    setFrom("");
                  }}
                >
                  Ver toda la temporada
                </button>
              )}
            </div>
          ) : (
            <div className="conflict-list">
              {groupBySlot(
                filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE),
              ).map((g) => (
                <section className="board-section" key={g.key}>
                  <h3 className="board-heading">
                    <span>{groupFormat.format(new Date(`${g.date}T12:00:00+01:00`))}</span>
                    <span className="heading-venue">
                      {g.venue} · {g.town}
                    </span>
                    <span className="board-count">{g.items.length}</span>
                  </h3>
                  <ul className="board conflict-board">
                    {g.items.map((item) => (
                      <ConflictRow
                        key={item.id}
                        item={item}
                        busy={saving === item.id}
                        onSave={save}
                      />
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
          {pages > 1 && (
            <nav className="pagination" aria-label="Páginas de incidencias">
              <button
                className="button secondary"
                disabled={current === 1}
                onClick={() => setPage(current - 1)}
              >
                <Icon name="chevron-left" />
                Anterior
              </button>
              <span>
                Página {current} de {pages}
              </span>
              <button
                className="button secondary"
                disabled={current === pages}
                onClick={() => setPage(current + 1)}
              >
                Siguiente
                <Icon name="chevron-right" />
              </button>
            </nav>
          )}
        </>
      )}
    </div>
  );
}
