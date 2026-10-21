import { useMemo, useState } from "react";
import TimeTile from "./TimeTile";
import { Icon } from "./Icon";
import { ErrorPanel, SkeletonRows } from "./states";
import {
  localDay,
  longDayLabel,
  mapsUrl,
  relativeDay,
  rival,
  type Calendar,
  type Match,
  type Team,
} from "./api";
import { categoryLabels, categoryOrder, upcomingMatches } from "./upcoming";

type Sort = "day" | "category";
type Entry = { team: Team; match: Match | null; category: string };

const readSort = (): Sort => {
  try {
    return localStorage.getItem("fbcv-upcoming-sort") === "category"
      ? "category"
      : "day";
  } catch {
    return "day";
  }
};

function FixtureRow({
  entry: { team, match: m, category },
  showDate,
  favorite,
  onOpen,
}: {
  entry: Entry & { match: Match };
  showDate: boolean;
  favorite: boolean;
  onOpen: () => void;
}) {
  const map = mapsUrl(m);
  return (
    <li className="fixture">
      <TimeTile match={m} showDate={showDate} />
      <div className="fixture-main">
        <button className="fixture-team stretched" onClick={onOpen}>
          {favorite && <Icon name="star" filled />}
          <span>{team.name}</span>
        </button>
        <span className="fixture-category">{category}</span>
      </div>
      <div className="fixture-rival">
        <span className={`side-pill ${m.home ? "home" : "away"}`}>
          {m.home ? "Local" : "Visitante"}
        </span>
        <span className="rival-name">
          <span className="visually-hidden">contra </span>
          {rival(m)}
        </span>
      </div>
      <div className="fixture-venue">
        {m.venue ? (
          <>
            <span className="venue-name">{m.venue}</span>
            {m.town && <span className="venue-town">{m.town}</span>}
          </>
        ) : (
          <span className="pending-text">Pabellón por confirmar</span>
        )}
      </div>
      <div className="fixture-actions">
        {map && (
          <a
            className="icon-button raised"
            href={map}
            target="_blank"
            rel="noreferrer"
            aria-label={`Cómo llegar a ${m.venue}`}
            title="Cómo llegar"
          >
            <Icon name="pin" />
          </a>
        )}
        <Icon name="chevron-right" />
      </div>
    </li>
  );
}

export default function UpcomingView({
  calendars,
  loading,
  error,
  onRetry,
  favorites,
  onOpenTeam,
}: {
  calendars: Calendar[];
  loading: boolean;
  error: string;
  onRetry: () => void;
  favorites: string[];
  onOpenTeam: (teamId: string) => void;
}) {
  const [sort, setSort] = useState<Sort>(readSort);
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const all = useMemo(() => upcomingMatches(calendars), [calendars]);
  const scoped =
    onlyFavorites && favorites.length
      ? all.filter((e) => favorites.includes(e.team.id))
      : all;
  const scheduled = scoped.filter(
    (e): e is Entry & { match: Match } => e.match !== null,
  );
  const unscheduled = scoped.filter((e) => e.match === null);
  const sections = (() => {
    const map = new Map<string, { title: string; note?: string | null; rows: typeof scheduled }>();
    const rows =
      sort === "day"
        ? [...scheduled].sort(
            (a, b) =>
              Date.parse(a.match.starts_at!) - Date.parse(b.match.starts_at!) ||
              categoryOrder(a.category) - categoryOrder(b.category),
          )
        : scheduled;
    for (const row of rows) {
      const key =
        sort === "day"
          ? localDay(row.match.starts_at!)
          : String(Math.min(categoryOrder(row.category), categoryLabels.length - 1));
      if (!map.has(key))
        map.set(key, {
          title:
            sort === "day"
              ? longDayLabel(row.match.starts_at!)
              : categoryLabels[Number(key)],
          note: sort === "day" ? relativeDay(row.match.starts_at!) : null,
          rows: [],
        });
      map.get(key)!.rows.push(row);
    }
    return [...map.values()];
  })();

  function changeSort(next: Sort) {
    setSort(next);
    try {
      localStorage.setItem("fbcv-upcoming-sort", next);
    } catch {
      /* Sorting still works without storage. */
    }
  }

  if (error) return <ErrorPanel message={error} onRetry={onRetry} />;
  const homeCount = scheduled.filter((e) => e.match.home).length;
  return (
    <div className="view">
      <div className="toolbar">
        <div>
          <h2 className="view-title">Próximos partidos</h2>
          <p className="view-meta">
            {loading
              ? "Buscando el siguiente partido de cada equipo…"
              : `${scheduled.length} ${scheduled.length === 1 ? "partido" : "partidos"} · ${homeCount} en casa · el siguiente de cada equipo`}
          </p>
        </div>
        <div className="toolbar-controls">
          {favorites.length > 0 && (
            <button
              className={`chip-toggle${onlyFavorites ? " is-on" : ""}`}
              aria-pressed={onlyFavorites}
              onClick={() => setOnlyFavorites(!onlyFavorites)}
            >
              <Icon name="star" filled={onlyFavorites} />
              Mis equipos
            </button>
          )}
          <div className="segmented" role="group" aria-label="Ordenar partidos">
            <button aria-pressed={sort === "day"} onClick={() => changeSort("day")}>
              Por día
            </button>
            <button
              aria-pressed={sort === "category"}
              onClick={() => changeSort("category")}
            >
              Por categoría
            </button>
          </div>
        </div>
      </div>
      {loading ? (
        <SkeletonRows count={6} />
      ) : (
        <>
          {sections.map((s) => (
            <section className="board-section" key={s.title}>
              <h3 className="board-heading">
                <span>{s.title}</span>
                {s.note && <span className="day-flag">{s.note}</span>}
                <span className="board-count">{s.rows.length}</span>
              </h3>
              <ul className="board">
                {s.rows.map((e) => (
                  <FixtureRow
                    key={e.team.id}
                    entry={e}
                    showDate={sort === "category"}
                    favorite={favorites.includes(e.team.id)}
                    onOpen={() => onOpenTeam(e.team.id)}
                  />
                ))}
              </ul>
            </section>
          ))}
          {!scheduled.length && (
            <div className="empty-panel">
              <h3>No hay partidos con fecha publicada</h3>
              <p>
                Cuando la FBCV publique las próximas jornadas aparecerán aquí.
                Mientras tanto, puedes consultar el calendario completo de cada
                equipo.
              </p>
            </div>
          )}
          {unscheduled.length > 0 && (
            <section className="board-section">
              <h3 className="board-heading quiet">
                <span>Sin próximo partido con fecha</span>
                <span className="board-count">{unscheduled.length}</span>
              </h3>
              <ul className="team-chips">
                {unscheduled.map((e) => (
                  <li key={e.team.id}>
                    <button onClick={() => onOpenTeam(e.team.id)}>
                      <span>{e.team.name}</span>
                      <small>{e.category}</small>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
