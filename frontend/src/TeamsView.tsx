import { useMemo, useState } from "react";
import SevenSeg from "./SevenSeg";
import TimeTile from "./TimeTile";
import { Icon } from "./Icon";
import { ErrorPanel, SkeletonRows } from "./states";
import { downloadIcs, teamIcs } from "./ics";
import {
  clock,
  day,
  dayWithWeekday,
  fold,
  isPlayed,
  mapsUrl,
  relativeDay,
  rival,
  type Calendar,
  type Match,
  type Team,
} from "./api";
import { categoryOrder } from "./upcoming";

const isUpcoming = (m: Match, now: number) =>
  !!m.starts_at && Date.parse(m.starts_at) >= now && !isPlayed(m);

function TeamList({
  teams,
  selectedId,
  favorites,
  onSelect,
  onToggleFavorite,
}: {
  teams: Team[];
  selectedId?: string;
  favorites: string[];
  onSelect: (id: string) => void;
  onToggleFavorite: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const shown = useMemo(() => {
    const q = fold(query.trim());
    return teams
      .filter(
        (t) => !q || fold(`${t.name} ${t.categories}`).includes(q),
      )
      .sort(
        (a, b) =>
          Number(favorites.includes(b.id)) - Number(favorites.includes(a.id)) ||
          categoryOrder(a.categories ?? "") - categoryOrder(b.categories ?? "") ||
          a.name.localeCompare(b.name, "es"),
      );
  }, [teams, query, favorites]);
  return (
    <div className="team-list-pane">
      <div className="search-field compact">
        <Icon name="search" />
        <input
          type="search"
          aria-label="Filtrar equipos"
          placeholder="Filtrar por nombre o categoría"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <ul className="team-list">
        {shown.map((t) => {
          const fav = favorites.includes(t.id);
          return (
            <li key={t.id} className={t.id === selectedId ? "is-selected" : undefined}>
              <button
                className="team-item stretched"
                aria-current={t.id === selectedId ? "page" : undefined}
                onClick={() => onSelect(t.id)}
              >
                <span className="team-item-name">{t.name}</span>
                <span className="team-item-meta">
                  {t.categories?.split(",")[0]}
                </span>
              </button>
              <button
                className={`star-button${fav ? " is-on" : ""}`}
                aria-pressed={fav}
                aria-label={fav ? `Dejar de seguir a ${t.name}` : `Seguir a ${t.name}`}
                title={fav ? "Dejar de seguir" : "Seguir equipo"}
                onClick={() => onToggleFavorite(t.id)}
              >
                <Icon name="star" filled={fav} />
              </button>
            </li>
          );
        })}
      </ul>
      {!shown.length && (
        <p className="empty-note">Ningún equipo coincide con «{query}».</p>
      )}
    </div>
  );
}

function NextMatch({ match: m }: { match: Match }) {
  const confirmed = m.time_confirmed;
  const map = mapsUrl(m);
  const when = relativeDay(m.starts_at!);
  return (
    <section className="scoreboard" aria-label="Próximo partido">
      <div className="scoreboard-head">
        <span className="scoreboard-kind">Próximo partido</span>
        <span>
          {when && <b>{when} · </b>}
          {dayWithWeekday(m.starts_at!)}
        </span>
      </div>
      <div className="scoreboard-body">
        <div className={`scoreboard-team${m.home ? " is-own" : ""}`}>
          <span className="scoreboard-side">Local</span>
          <strong>{m.home_team}</strong>
        </div>
        <div className="scoreboard-clock">
          <SevenSeg
            value={confirmed ? clock(m.starts_at!) : "--:--"}
            label={confirmed ? `A las ${clock(m.starts_at!)}` : "Hora por confirmar"}
            size="lg"
          />
          {!confirmed && <span className="pending-text">Hora por confirmar</span>}
        </div>
        <div className={`scoreboard-team away${!m.home ? " is-own" : ""}`}>
          <span className="scoreboard-side">Visitante</span>
          <strong>{m.away_team}</strong>
        </div>
      </div>
      <div className="scoreboard-foot">
        <span className="scoreboard-venue">
          <Icon name="pin" />
          {m.venue ? (
            <span>
              {m.venue}
              {m.town && <small> · {m.town}</small>}
            </span>
          ) : (
            <span>Pabellón por confirmar</span>
          )}
        </span>
        {map && (
          <a className="button on-shell" href={map} target="_blank" rel="noreferrer">
            Cómo llegar
            <Icon name="external" />
          </a>
        )}
      </div>
      {m.message && <p className="scoreboard-note">{m.message}</p>}
    </section>
  );
}

function TeamCalendar({
  calendar,
  favorite,
  onToggleFavorite,
  onBack,
}: {
  calendar: Calendar;
  favorite: boolean;
  onToggleFavorite: () => void;
  onBack: () => void;
}) {
  const now = Date.now();
  const [groupId, setGroupId] = useState(() => {
    const live = calendar.groups.find((g) =>
      g.rounds.some((r) => r.matches.some((m) => isUpcoming(m, now))),
    );
    return (live || calendar.groups.at(-1))?.id || "";
  });
  const group = calendar.groups.find((g) => g.id === groupId) ?? calendar.groups[0];
  const next = calendar.groups
    .flatMap((g) => g.rounds.flatMap((r) => r.matches))
    .filter((m) => isUpcoming(m, now))
    .sort((a, b) => Date.parse(a.starts_at!) - Date.parse(b.starts_at!))[0];
  const nextInGroup = group?.rounds.find((r) =>
    r.matches.some((m) => isUpcoming(m, now)),
  )?.number;
  const pending = teamIcs(calendar).count;
  const { team } = calendar;
  return (
    <div className="team-calendar">
      <button className="back-link" onClick={onBack}>
        <Icon name="chevron-left" />
        Todos los equipos
      </button>
      <header className="team-header">
        <div>
          <h2 className="view-title">{team.name}</h2>
          <p className="view-meta">
            {team.categories?.split(",").join(" · ")} · {team.match_count} partidos
          </p>
        </div>
        <div className="team-actions">
          <button
            className={`button secondary${favorite ? " is-on" : ""}`}
            aria-pressed={favorite}
            onClick={onToggleFavorite}
          >
            <Icon name="star" filled={favorite} />
            {favorite ? "Siguiendo" : "Seguir"}
          </button>
          <button
            className="button primary"
            disabled={!pending}
            onClick={() => downloadIcs(calendar)}
            title={
              pending
                ? `Descarga ${pending} partidos en formato .ics para tu móvil o Google Calendar`
                : "No hay partidos futuros con fecha"
            }
          >
            <Icon name="calendar-plus" />
            Añadir a mi calendario
          </button>
        </div>
      </header>
      {next ? (
        <NextMatch match={next} />
      ) : (
        <p className="empty-note boxed">
          Este equipo no tiene partidos futuros con fecha publicada.
        </p>
      )}
      {calendar.groups.length > 1 && (
        <div className="competition-picker">
          <label htmlFor="competition">Competición</label>
          <select
            id="competition"
            value={group?.id}
            onChange={(e) => setGroupId(e.target.value)}
          >
            {calendar.groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.category} · {g.name}
              </option>
            ))}
          </select>
        </div>
      )}
      {group && (
        <section className="rounds-section" aria-label={`Jornadas de ${group.category}`}>
          <h3 className="board-heading">
            <span>
              {group.category} · {group.name}
            </span>
            <span className="board-count">{group.rounds.length} jornadas</span>
          </h3>
          <ol className="rounds">
            {group.rounds.map((r) => (
              <li
                key={r.number}
                className={`round${r.number === nextInGroup ? " is-next" : ""}${
                  r.matches.length && r.matches.every(isPlayed) ? " is-played" : ""
                }`}
              >
                <div className="round-number">
                  <span>J</span>
                  {r.number.padStart(2, "0")}
                  {r.number === nextInGroup && <em>Próxima</em>}
                </div>
                {r.matches.map((m) => (
                  <div className="round-match" key={m.id}>
                    <TimeTile match={m} size="sm" />
                    <div className="round-date">
                      {m.starts_at ? dayWithWeekday(m.starts_at) : r.nominal_date ? `Semana del ${day(r.nominal_date)}` : "Fecha por confirmar"}
                    </div>
                    <div className="fixture-rival">
                      <span className={`side-pill ${m.home ? "home" : "away"}`}>
                        {m.home ? "Local" : "Visitante"}
                      </span>
                      <span className="rival-name">{rival(m)}</span>
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
                    <a
                      className="icon-button ghost"
                      href={m.source_url}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`Ver jornada ${r.number} en la web de la FBCV`}
                      title="Ver en FBCV"
                    >
                      <Icon name="external" />
                    </a>
                    {m.message && <p className="round-note">{m.message}</p>}
                  </div>
                ))}
                {r.rest && !r.matches.length && (
                  <div className="round-rest">
                    {r.nominal_date && <span>{day(r.nominal_date)}</span>}
                    Jornada de descanso
                  </div>
                )}
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}

export default function TeamsView({
  teams,
  calendars,
  loading,
  error,
  onRetry,
  teamId,
  favorites,
  onSelectTeam,
  onToggleFavorite,
}: {
  teams: Team[];
  calendars: Calendar[];
  loading: boolean;
  error: string;
  onRetry: () => void;
  teamId?: string;
  favorites: string[];
  onSelectTeam: (id?: string) => void;
  onToggleFavorite: (id: string) => void;
}) {
  const calendar = calendars.find((c) => c.team.id === teamId);
  const team = teams.find((t) => t.id === teamId);
  return (
    <div className={`teams-layout${team ? " has-team" : ""}`}>
      <aside className="teams-aside" aria-label="Equipos del club">
        <h2 className="pane-title">
          Equipos <span className="board-count">{teams.length}</span>
        </h2>
        <TeamList
          teams={teams}
          selectedId={teamId}
          favorites={favorites}
          onSelect={onSelectTeam}
          onToggleFavorite={onToggleFavorite}
        />
      </aside>
      <div className="teams-main">
        {error ? (
          <ErrorPanel message={error} onRetry={onRetry} />
        ) : calendar ? (
          <TeamCalendar
            key={calendar.team.id}
            calendar={calendar}
            favorite={favorites.includes(calendar.team.id)}
            onToggleFavorite={() => onToggleFavorite(calendar.team.id)}
            onBack={() => onSelectTeam(undefined)}
          />
        ) : team && loading ? (
          <SkeletonRows count={8} />
        ) : (
          <div className="empty-panel">
            <Icon name="list" />
            <h3>Elige un equipo</h3>
            <p>
              Verás su próximo partido, todas las jornadas de cada competición y
              podrás añadirlas al calendario de tu móvil. Marca con la estrella
              los equipos que sigues para tenerlos siempre arriba.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
