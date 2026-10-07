import ThemeToggle from "./ThemeToggle";
import ConflictsPanel from "./ConflictsPanel";
import { useEffect, useMemo, useRef, useState } from "react";

type Club = { id: string; name: string; team_count: number };
type Team = {
  id: string;
  name: string;
  match_count: number;
  group_count: number;
  categories: string;
};
type Match = {
  id: string;
  home: boolean;
  home_team: string;
  away_team: string;
  starts_at: string | null;
  time_confirmed: boolean;
  venue: string | null;
  town: string | null;
  address: string | null;
  home_score: string | null;
  away_score: string | null;
  message: string | null;
  source_url: string;
};
type Round = {
  number: string;
  nominal_date: string | null;
  rest: boolean;
  matches: Match[];
};
type Group = {
  id: string;
  name: string;
  category: string;
  phase: string;
  rounds: Round[];
};
type Calendar = { team: Team; groups: Group[] };
type Meta = { season_label: string; updated_at: string | null; status: string };
const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
const day = (s: string) =>
  new Intl.DateTimeFormat("es-ES", {
    day: "numeric",
    month: "short",
    timeZone: "Europe/Madrid",
  }).format(new Date(s.length === 10 ? `${s}T12:00:00+02:00` : s));
const clock = (s: string) =>
  new Intl.DateTimeFormat("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Madrid",
  }).format(new Date(s));
async function get<T>(url: string, signal?: AbortSignal): Promise<T> {
  const r = await fetch(url, { signal });
  if (!r.ok)
    throw new Error(
      "No se han podido cargar los datos. Comprueba que la app está en marcha y vuelve a intentarlo.",
    );
  return r.json();
}
function Ball() {
  return (
    <svg viewBox="0 0 40 40" aria-hidden="true">
      <circle cx="20" cy="20" r="17" />
      <path d="M3 20h34M20 3v34M8 8c16 3 20 15 24 24M32 8C16 11 12 23 8 32" />
    </svg>
  );
}
function Arrow() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="m7 4 6 6-6 6" />
    </svg>
  );
}
function ClubPicker({
  clubs,
  selected,
  onSelect,
}: {
  clubs: Club[];
  selected: Club | null;
  onSelect: (c: Club) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const results = useMemo(
    () => clubs.filter((c) => fold(c.name).includes(fold(query))),
    [clubs, query],
  );
  useEffect(() => {
    function outside(e: PointerEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, []);
  useEffect(() => {
    ref.current
      ?.querySelector(`#club-option-${active}`)
      ?.scrollIntoView({ block: "nearest" });
  }, [active]);
  function choose(c: Club) {
    onSelect(c);
    setQuery("");
    setOpen(false);
    input.current?.focus();
  }
  return (
    <div className="picker" ref={ref}>
      <label htmlFor="club-search">Tu club</label>
      <div className={`search-box ${open ? "is-open" : ""}`}>
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <circle cx="8" cy="8" r="5" />
          <path d="m12 12 5 5" />
        </svg>
        <input
          ref={input}
          id="club-search"
          role="combobox"
          aria-expanded={open}
          aria-controls="club-options"
          aria-autocomplete="list"
          aria-activedescendant={
            open && results.length ? `club-option-${active}` : undefined
          }
          autoComplete="off"
          placeholder={selected ? selected.name : "Busca o elige tu club…"}
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
            setOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setOpen(false);
              return;
            }
            if (e.key === "ArrowDown" || e.key === "ArrowUp") {
              e.preventDefault();
              setOpen(true);
              setActive((a) =>
                Math.max(
                  0,
                  Math.min(
                    results.length - 1,
                    a + (e.key === "ArrowDown" ? 1 : -1),
                  ),
                ),
              );
            }
            if (e.key === "Enter" && open && results[active]) {
              e.preventDefault();
              choose(results[active]);
            }
          }}
        />
        <button
          className="dropdown-toggle"
          aria-label={open ? "Cerrar clubes" : "Mostrar clubes"}
          onClick={() => {
            setOpen(!open);
            if (!open) input.current?.focus();
          }}
        >
          <span aria-hidden="true">⌄</span>
        </button>
      </div>
      {open && (
        <div className="club-menu">
          <div className="menu-label">{results.length} clubes disponibles</div>
          <ul id="club-options" role="listbox" aria-label="Clubes">
            {results.map((c, i) => (
              <li
                key={c.id}
                id={`club-option-${i}`}
                role="option"
                aria-selected={selected?.id === c.id}
                className={active === i ? "highlighted" : ""}
                onPointerMove={() => setActive(i)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(c)}
              >
                <span>{c.name}</span>
                <small>{c.team_count} equipos</small>
              </li>
            ))}
          </ul>
          {!results.length && (
            <p className="no-results">
              No hay clubes con ese nombre. Prueba con menos letras.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
function MatchCard({ match: m, team }: { match: Match; team: string }) {
  const played = m.home_score !== null && m.away_score !== null;
  return (
    <div className="match">
      <div className="match-top">
        <span className={`location ${m.home ? "home" : "away"}`}>
          {m.home ? "En casa" : "Visitante"}
        </span>
        <span className="match-date">
          {m.starts_at ? day(m.starts_at) : "Fecha pendiente"}
          <b>
            {m.starts_at && m.time_confirmed
              ? clock(m.starts_at)
              : "Hora por confirmar"}
          </b>
        </span>
      </div>
      <div className="opponents">
        <div className={m.home ? "own-team" : ""}>
          {m.home_team}
          <span>{played ? m.home_score : ""}</span>
        </div>
        <div className={!m.home ? "own-team" : ""}>
          {m.away_team}
          <span>{played ? m.away_score : ""}</span>
        </div>
        {!played && <span className="versus">vs</span>}
      </div>
      <div className="match-bottom">
        <span>
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <path d="M10 18s6-6 6-10a6 6 0 1 0-12 0c0 4 6 10 6 10Z" />
            <circle cx="10" cy="8" r="2" />
          </svg>
          {m.venue || "Pabellón por confirmar"}
          {m.town && <small>{m.town}</small>}
        </span>
        <a
          href={m.source_url}
          target="_blank"
          rel="noreferrer"
          aria-label={`Ver partido de ${team} en la web de FBCV`}
        >
          FBCV ↗
        </a>
      </div>
      {m.message && <p className="match-note">{m.message}</p>}
    </div>
  );
}
export default function App() {
  const [view, setView] = useState("calendar");
  const [clubs, setClubs] = useState<Club[]>([]);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [club, setClub] = useState<Club | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [team, setTeam] = useState<Team | null>(null);
  const [calendar, setCalendar] = useState<Calendar | null>(null);
  const [groupId, setGroupId] = useState("");
  const [loading, setLoading] = useState("clubs");
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const c = new AbortController();
    setError("");
    setLoading("clubs");
    Promise.all([
      get<Club[]>("/api/clubs", c.signal),
      get<Meta>("/api/meta", c.signal),
    ])
      .then(([cs, m]) => {
        setClubs(cs);
        setMeta(m);
        setLoading("");
      })
      .catch((e) => {
        if (e.name !== "AbortError") {
          setError(e.message);
          setLoading("");
        }
      });
    return () => c.abort();
  }, [retry]);
  useEffect(() => {
    if (!club) return;
    const c = new AbortController();
    setError("");
    setLoading("teams");
    get<Team[]>(`/api/clubs/${club.id}/teams`, c.signal)
      .then((t) => {
        setTeams(t);
        setLoading("");
      })
      .catch((e) => {
        if (e.name !== "AbortError") {
          setError(e.message);
          setLoading("");
        }
      });
    return () => c.abort();
  }, [club, retry]);
  useEffect(() => {
    if (!club || !team) return;
    const c = new AbortController();
    setError("");
    setLoading("calendar");
    get<Calendar>(`/api/clubs/${club.id}/teams/${team.id}/calendar`, c.signal)
      .then((data) => {
        setCalendar(data);
        const upcoming = data.groups.find((g) =>
          g.rounds.some((r) =>
            r.matches.some(
              (m) => m.starts_at && new Date(m.starts_at) > new Date(),
            ),
          ),
        );
        setGroupId((upcoming || data.groups.at(-1))?.id || "");
        setLoading("");
      })
      .catch((e) => {
        if (e.name !== "AbortError") {
          setError(e.message);
          setLoading("");
        }
      });
    return () => c.abort();
  }, [team, club, retry]);
  function selectClub(c: Club) {
    if (club?.id === c.id) return;
    setClub(c);
    setTeams([]);
    setTeam(null);
    setCalendar(null);
  }
  function selectTeam(t: Team) {
    if (team?.id === t.id) return;
    setTeam(t);
    setCalendar(null);
  }
  const group = calendar?.groups.find((g) => g.id === groupId);
  const next = group?.rounds
    .flatMap((r) => r.matches)
    .filter((m) => m.starts_at && new Date(m.starts_at) > new Date())
    .sort((a, b) => a.starts_at!.localeCompare(b.starts_at!))[0];
  return (
    <>
      <header className="topbar">
        <a className="brand" href="/" aria-label="En pista, inicio">
          <Ball />
          <span>
            EN PISTA<small>CALENDARIOS FBCV</small>
          </span>
        </a>
        <div className="header-actions">
          <div className="season">
            <span className="status-dot" />
            TEMPORADA {meta?.season_label || "2026–2027"}
          </div>
          <ThemeToggle />
        </div>
      </header>
      <main>
        <div className="intro">
          <div>
            <p className="eyebrow">TU CLUB. TUS EQUIPOS. CADA JORNADA.</p>
            <h1>
              Todo el juego,
              <br className="mobile-break" /> en un solo lugar.
            </h1>
            <p>
              Encuentra tu club y consulta cuándo y dónde juega cada equipo.
            </p>
          </div>
          <div className="season-mark" aria-hidden="true">
            26<span>/</span>27
          </div>
        </div>
        <nav className="view-tabs" aria-label="Vistas del club">
          <button
            aria-pressed={view === "calendar"}
            onClick={() => setView("calendar")}
          >
            Calendarios
          </button>
          <button
            aria-pressed={view === "conflicts"}
            onClick={() => setView("conflicts")}
          >
            Incompatibilidades
          </button>
        </nav>
        <div className="workspace">
          <aside className="sidebar">
            <ClubPicker clubs={clubs} selected={club} onSelect={selectClub} />
            {loading === "clubs" && (
              <p className="loading" role="status">
                Cargando clubes…
              </p>
            )}
            {club && (
              <>
                <div className="club-heading">
                  <div className="club-monogram">
                    {club.name
                      .split(" ")
                      .filter((s) => s.length > 2)
                      .slice(0, 2)
                      .map((s) => s[0])
                      .join("")}
                  </div>
                  <div>
                    <h2>{club.name}</h2>
                    <p>{teams.length} equipos con calendario</p>
                  </div>
                </div>
                {view === "calendar" && (
                  <>
                    <div className="section-label">
                      ELIGE UN EQUIPO{" "}
                      <span>{teams.length.toString().padStart(2, "0")}</span>
                    </div>
                    {loading === "teams" ? (
                      <p role="status" className="loading">
                        Buscando equipos…
                      </p>
                    ) : (
                      <div className="team-list">
                        {teams.map((t) => (
                          <button
                            key={t.id}
                            className={`team-button ${team?.id === t.id ? "selected" : ""}`}
                            aria-pressed={team?.id === t.id}
                            onClick={() => selectTeam(t)}
                          >
                            <div>
                              <span>{t.name}</span>
                              <small>{t.categories?.split(",")[0]}</small>
                              <em>
                                {t.match_count} partidos · {t.group_count}{" "}
                                {t.group_count === 1
                                  ? "competición"
                                  : "competiciones"}
                              </em>
                            </div>
                            <Arrow />
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
                {view === "conflicts" && (
                  <p className="muted">
                    Consulta las coincidencias de todos los equipos del club.
                    Usa los filtros para centrar la revisión.
                  </p>
                )}
                {!teams.length && loading !== "teams" && (
                  <p className="muted">
                    Este club no tiene equipos con calendario publicado.
                  </p>
                )}
              </>
            )}
            {!club && (
              <div className="sidebar-hint">
                <span className="hint-line" />
                <p>
                  Empieza por tu club.
                  <br />
                  Después, elige el equipo
                  <br />
                  que quieres seguir.
                </p>
              </div>
            )}
          </aside>
          <section
            className="calendar-panel"
            aria-label={
              view === "calendar"
                ? "Calendario del equipo"
                : "Incompatibilidades del club"
            }
          >
            {view === "conflicts" &&
              (club ? (
                <ConflictsPanel
                  key={club.id}
                  clubId={club.id}
                  clubName={club.name}
                  teams={teams}
                />
              ) : (
                <div className="empty-state">
                  <h2>Elige tu club.</h2>
                  <p>
                    Selecciona un club para revisar las posibles
                    incompatibilidades de sus equipos.
                  </p>
                </div>
              ))}
            {view === "calendar" && (
              <>
                <div className="panel-toolbar">
                  <span className="section-label">
                    {team ? "CALENDARIO DEL EQUIPO" : "TU CALENDARIO"}
                  </span>
                  <span className="subtle">Por jornadas</span>
                </div>
                {error && (
                  <div className="error" role="alert">
                    <p>{error}</p>
                    <button onClick={() => setRetry((r) => r + 1)}>
                      Volver a intentar
                    </button>
                  </div>
                )}
                {!team && !error && (
                  <div className="empty-state">
                    <div className="court" aria-hidden="true">
                      <div className="court-mid" />
                      <div className="court-circle" />
                      <div className="court-key left" />
                      <div className="court-key right" />
                      <Ball />
                    </div>
                    <p className="eyebrow">EL SIGUIENTE PARTIDO EMPIEZA AQUÍ</p>
                    <h2>{club ? "Elige tu equipo." : "Busca tu club."}</h2>
                    <p>
                      {club
                        ? "Selecciona un equipo para ver sus partidos, jornadas y pabellones."
                        : "Todos sus equipos y calendarios, preparados para que no te pierdas ninguna jornada."}
                    </p>
                    <div className="empty-chips">
                      <span>Club</span>
                      <i>→</i>
                      <span>Equipo</span>
                      <i>→</i>
                      <span>Calendario</span>
                    </div>
                  </div>
                )}
                {team && (
                  <>
                    <div className="team-title">
                      <p className="eyebrow">{club?.name}</p>
                      <h2>{team.name}</h2>
                    </div>
                    {loading === "calendar" && (
                      <div className="loading-calendar" role="status">
                        <span className="spinner" />
                        Cargando jornadas…
                      </div>
                    )}
                    {calendar && group && (
                      <>
                        <div className="calendar-controls">
                          <div>
                            <label htmlFor="competition">
                              Competición y fase
                            </label>
                            <select
                              id="competition"
                              value={groupId}
                              onChange={(e) => setGroupId(e.target.value)}
                            >
                              {calendar.groups.map((g) => (
                                <option key={g.id} value={g.id}>
                                  {g.category} · {g.name}
                                </option>
                              ))}
                            </select>
                          </div>
                          <span className="round-count">
                            {group.rounds.length} jornadas
                          </span>
                        </div>
                        {next && (
                          <div className="next-match">
                            <span className="next-label">
                              <span className="status-dot" />
                              PRÓXIMO PARTIDO
                            </span>
                            <span>
                              {day(next.starts_at!)}
                              {next.time_confirmed
                                ? ` · ${clock(next.starts_at!)}`
                                : " · Hora por confirmar"}
                            </span>
                            <strong>
                              {next.home ? next.away_team : next.home_team}
                            </strong>
                            <span className="next-location">
                              {next.home ? "En casa" : "Visitante"}
                            </span>
                          </div>
                        )}
                        <div className="rounds">
                          {group.rounds.map((r) => (
                            <article className="round" key={r.number}>
                              <div className="round-marker">
                                <span>JORNADA</span>
                                <b>{r.number.padStart(2, "0")}</b>
                                {r.nominal_date && (
                                  <small>{day(r.nominal_date)}</small>
                                )}
                              </div>
                              <div className="round-content">
                                {r.matches.map((m) => (
                                  <MatchCard
                                    key={m.id}
                                    match={m}
                                    team={team.name}
                                  />
                                ))}
                                {r.rest && (
                                  <div className="rest">
                                    <span>—</span>
                                    <div>
                                      <strong>Jornada de descanso</strong>
                                      <p>
                                        Este equipo no juega en esta jornada.
                                      </p>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </article>
                          ))}
                        </div>
                      </>
                    )}
                  </>
                )}
              </>
            )}
          </section>
        </div>
        <footer>
          <span>
            En pista · Calendarios de baloncesto de la Comunitat Valenciana
          </span>
          <span>
            {meta?.updated_at
              ? `Datos consultados el ${new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "long", timeZone: "Europe/Madrid" }).format(new Date(meta.updated_at))}`
              : "Datos de FBCV"}{" "}
            ·{" "}
            <a
              href="https://www.fbcv.es/competiciones/calendario-resultados-y-clasificacion/"
              target="_blank"
              rel="noreferrer"
            >
              Fuente FBCV ↗
            </a>
          </span>
        </footer>
      </main>
    </>
  );
}
