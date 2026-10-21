import { useCallback, useEffect, useRef, useState } from "react";
import ThemeToggle from "./ThemeToggle";
import ConflictsPanel from "./ConflictsPanel";
import ClubSearch from "./ClubSearch";
import UpcomingView from "./UpcomingView";
import TeamsView from "./TeamsView";
import SevenSeg from "./SevenSeg";
import { BrandMark, Icon } from "./Icon";
import { ErrorPanel } from "./states";
import {
  FBCV_URL,
  get,
  initials,
  type Calendar,
  type Club,
  type Meta,
  type Team,
} from "./api";

export type { Calendar } from "./api";

type View = "proximos" | "equipos" | "incompatibilidades";
type Route = { club?: string; view: View; team?: string };
const VIEWS: { id: View; label: string }[] = [
  { id: "proximos", label: "Próximos" },
  { id: "equipos", label: "Equipos" },
  { id: "incompatibilidades", label: "Incompatibilidades" },
];

const store = {
  read(key: string) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  write(key: string, value: string | null) {
    try {
      if (value === null) localStorage.removeItem(key);
      else localStorage.setItem(key, value);
    } catch {
      /* Preferences are a convenience; the app works without storage. */
    }
  },
};

function readRoute(): Route {
  const p = new URLSearchParams(location.search);
  const view = VIEWS.some((v) => v.id === p.get("vista"))
    ? (p.get("vista") as View)
    : "proximos";
  return {
    club: p.get("club") || undefined,
    view,
    team: (view === "equipos" && p.get("equipo")) || undefined,
  };
}

function routeUrl(r: Route) {
  const p = new URLSearchParams();
  if (r.club) p.set("club", r.club);
  if (r.club && r.view !== "proximos") p.set("vista", r.view);
  if (r.club && r.view === "equipos" && r.team) p.set("equipo", r.team);
  const q = p.toString();
  return q ? `/?${q}` : "/";
}

function readFavorites(): Record<string, string[]> {
  try {
    const value = JSON.parse(store.read("fbcv-favorites") || "{}");
    return value && typeof value === "object" ? value : {};
  } catch {
    return {};
  }
}

export default function App() {
  const [route, setRoute] = useState<Route>(() => {
    const r = readRoute();
    return r.club ? r : { ...r, club: store.read("fbcv-club") || undefined };
  });
  const [clubs, setClubs] = useState<Club[]>([]);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [clubsError, setClubsError] = useState("");
  const [clubsLoading, setClubsLoading] = useState(true);
  const [clubsRetry, setClubsRetry] = useState(0);
  const [teams, setTeams] = useState<Team[]>([]);
  const [calendars, setCalendars] = useState<Calendar[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [dataError, setDataError] = useState("");
  const [dataRetry, setDataRetry] = useState(0);
  const [favorites, setFavorites] = useState(readFavorites);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const switcher = useRef<HTMLDivElement>(null);
  const club = clubs.find((c) => c.id === route.club) ?? null;

  const navigate = useCallback((next: Route, replace = false) => {
    setRoute(next);
    const url = routeUrl(next);
    if (url !== location.pathname + location.search)
      history[replace ? "replaceState" : "pushState"](null, "", url);
    if (!replace) window.scrollTo({ top: 0 });
  }, []);

  useEffect(() => {
    const onPop = () => setRoute(readRoute());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  useEffect(() => {
    const c = new AbortController();
    setClubsError("");
    setClubsLoading(true);
    Promise.all([
      get<Club[]>("/api/clubs", c.signal),
      get<Meta>("/api/meta", c.signal),
    ])
      .then(([cs, m]) => {
        setClubs(cs);
        setMeta(m);
        setClubsLoading(false);
      })
      .catch((e) => {
        if (e.name !== "AbortError") {
          setClubsError(e.message);
          setClubsLoading(false);
        }
      });
    return () => c.abort();
  }, [clubsRetry]);

  // Keep the address bar in step with the remembered club, and forget a
  // club that no longer exists this season.
  useEffect(() => {
    if (clubsLoading || clubsError) return;
    if (route.club && !club) {
      store.write("fbcv-club", null);
      navigate({ view: "proximos" }, true);
    } else if (club) {
      store.write("fbcv-club", club.id);
      navigate(route, true);
    }
  }, [clubsLoading, clubsError, club, route, navigate]);

  useEffect(() => {
    if (!club) return;
    const c = new AbortController();
    setDataError("");
    setDataLoading(true);
    setTeams([]);
    setCalendars([]);
    get<Team[]>(`/api/clubs/${club.id}/teams`, c.signal)
      .then((ts) => {
        setTeams(ts);
        return Promise.all(
          ts.map((t) =>
            get<Calendar>(
              `/api/clubs/${club.id}/teams/${t.id}/calendar`,
              c.signal,
            ),
          ),
        );
      })
      .then((data) => {
        setCalendars(data);
        setDataLoading(false);
      })
      .catch((e) => {
        if (e.name !== "AbortError") {
          setDataError(e.message);
          setDataLoading(false);
        }
      });
    return () => c.abort();
  }, [club, dataRetry]);

  useEffect(() => {
    if (!switcherOpen) return;
    const outside = (e: PointerEvent) => {
      if (!switcher.current?.contains(e.target as Node)) setSwitcherOpen(false);
    };
    const escape = (e: KeyboardEvent) => e.key === "Escape" && setSwitcherOpen(false);
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [switcherOpen]);

  useEffect(() => {
    document.title = club ? `${club.name} · En pista` : "En pista · Calendarios FBCV";
  }, [club]);

  function selectClub(c: Club) {
    setSwitcherOpen(false);
    navigate({ club: c.id, view: route.club === c.id ? route.view : "proximos" });
  }

  const clubFavorites = (club && favorites[club.id]) || [];
  function toggleFavorite(teamId: string) {
    if (!club) return;
    const list = clubFavorites.includes(teamId)
      ? clubFavorites.filter((id) => id !== teamId)
      : [...clubFavorites, teamId];
    const next = { ...favorites, [club.id]: list };
    setFavorites(next);
    store.write("fbcv-favorites", JSON.stringify(next));
  }

  const updated = meta?.updated_at
    ? new Intl.DateTimeFormat("es-ES", {
        day: "numeric",
        month: "long",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Europe/Madrid",
      }).format(new Date(meta.updated_at))
    : null;
  const season = meta?.season_label || "2026–2027";

  return (
    <div className="app">
      <a className="skip-link" href="#contenido">
        Saltar al contenido
      </a>
      <header className="shell">
        <div className="shell-inner">
          <a
            className="brand"
            href={routeUrl({ club: club?.id, view: "proximos" })}
            onClick={(e) => {
              e.preventDefault();
              navigate({ club: club?.id, view: "proximos" });
            }}
          >
            <BrandMark />
            <span className="brand-name">En pista</span>
          </a>
          <span className="season" title={`Temporada ${season}`}>
            <span className="season-label">Temporada</span>
            <SevenSeg
              value={season.replace(/^20(\d\d)\D20(\d\d)$/, "$1-$2")}
              label={season}
              size="sm"
            />
          </span>
          <div className="shell-actions">
            {club && (
              <div className="switcher" ref={switcher}>
                <button
                  className="switcher-button"
                  aria-expanded={switcherOpen}
                  aria-haspopup="dialog"
                  onClick={() => setSwitcherOpen(!switcherOpen)}
                >
                  <Icon name="swap" />
                  <span>Cambiar de club</span>
                </button>
                {switcherOpen && (
                  <div className="switcher-panel" role="dialog" aria-label="Cambiar de club">
                    <ClubSearch
                      clubs={clubs}
                      selectedId={club.id}
                      onSelect={selectClub}
                      autoFocus
                    />
                  </div>
                )}
              </div>
            )}
            <ThemeToggle />
          </div>
        </div>
      </header>

      {club ? (
        <>
          <div className="club-bar">
            <div className="club-bar-inner">
              <div className="club-identity">
                <span className="club-monogram" aria-hidden="true">
                  {initials(club.name)}
                </span>
                <div>
                  <h1>{club.name}</h1>
                  <p>
                    {club.team_count}{" "}
                    {club.team_count === 1 ? "equipo" : "equipos"} ·{" "}
                    <span className="nowrap">Temporada {season}</span>
                  </p>
                </div>
              </div>
            </div>
          </div>
          <div className="tabs-bar">
            <div className="tabs-inner">
              <nav className="tabs" aria-label="Secciones del club">
                {VIEWS.map((v) => (
                  <a
                    key={v.id}
                    href={routeUrl({ club: club.id, view: v.id })}
                    aria-current={route.view === v.id ? "page" : undefined}
                    onClick={(e) => {
                      e.preventDefault();
                      navigate({ club: club.id, view: v.id });
                    }}
                  >
                    {v.label}
                  </a>
                ))}
              </nav>
            </div>
          </div>
          <main id="contenido" className="content">
            {route.view === "proximos" && (
              <UpcomingView
                calendars={calendars}
                loading={dataLoading}
                error={dataError}
                onRetry={() => setDataRetry((r) => r + 1)}
                favorites={clubFavorites}
                onOpenTeam={(team) => navigate({ club: club.id, view: "equipos", team })}
              />
            )}
            {route.view === "equipos" && (
              <TeamsView
                teams={teams}
                calendars={calendars}
                loading={dataLoading}
                error={dataError}
                onRetry={() => setDataRetry((r) => r + 1)}
                teamId={route.team}
                favorites={clubFavorites}
                onSelectTeam={(team) => navigate({ club: club.id, view: "equipos", team })}
                onToggleFavorite={toggleFavorite}
              />
            )}
            {route.view === "incompatibilidades" && (
              <ConflictsPanel
                key={club.id}
                clubId={club.id}
                clubName={club.name}
                teams={teams}
              />
            )}
          </main>
        </>
      ) : (
        <main id="contenido" className="welcome">
          <div className="welcome-card">
            <h1>¿De qué club eres?</h1>
            <p className="welcome-lead">
              Elige tu club y verás el próximo partido de cada equipo, sus
              calendarios completos y los posibles choques de horario en la
              misma pista.
            </p>
            {clubsError ? (
              <ErrorPanel message={clubsError} onRetry={() => setClubsRetry((r) => r + 1)} />
            ) : (
              <ClubSearch
                clubs={clubs}
                onSelect={selectClub}
                loading={clubsLoading || (!!route.club && !club)}
                autoFocus={matchMedia("(min-width: 720px)").matches}
              />
            )}
            <p className="welcome-note">
              Recordaremos tu club en este dispositivo. Podrás cambiarlo cuando
              quieras.
            </p>
          </div>
        </main>
      )}

      <footer className="footer">
        <div className="footer-inner">
          <span>
            Datos publicados por la FBCV
            {updated ? `, consultados el ${updated}` : ""}.
          </span>
          <span>
            En pista no es un servicio oficial de la federación.{" "}
            <a href={FBCV_URL} target="_blank" rel="noreferrer">
              Calendario oficial <Icon name="external" />
            </a>
          </span>
        </div>
      </footer>
    </div>
  );
}
