import { useEffect, useId, useMemo, useRef, useState } from "react";
import { fold, type Club } from "./api";
import { Icon } from "./Icon";

export default function ClubSearch({
  clubs,
  selectedId,
  onSelect,
  autoFocus = false,
  loading = false,
}: {
  clubs: Club[];
  selectedId?: string;
  onSelect: (c: Club) => void;
  autoFocus?: boolean;
  loading?: boolean;
}) {
  const id = useId();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const list = useRef<HTMLUListElement>(null);
  const results = useMemo(() => {
    const q = fold(query.trim());
    return q ? clubs.filter((c) => fold(c.name).includes(q)) : clubs;
  }, [clubs, query]);
  useEffect(() => {
    list.current
      ?.querySelector(`[data-index="${active}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [active]);
  return (
    <div className="club-search">
      <label htmlFor={`${id}-input`} className="visually-hidden">
        Buscar club
      </label>
      <div className="search-field">
        <Icon name="search" />
        <input
          id={`${id}-input`}
          role="combobox"
          aria-expanded="true"
          aria-controls={`${id}-list`}
          aria-autocomplete="list"
          aria-activedescendant={
            results.length ? `${id}-opt-${active}` : undefined
          }
          autoComplete="off"
          spellCheck={false}
          autoFocus={autoFocus}
          placeholder="Escribe el nombre del club"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown" || e.key === "ArrowUp") {
              e.preventDefault();
              const step = e.key === "ArrowDown" ? 1 : -1;
              setActive((a) =>
                Math.max(0, Math.min(results.length - 1, a + step)),
              );
            } else if (e.key === "Enter" && results[active]) {
              e.preventDefault();
              onSelect(results[active]);
            }
          }}
        />
        {query && (
          <button
            type="button"
            className="icon-button ghost"
            aria-label="Borrar búsqueda"
            onClick={() => {
              setQuery("");
              setActive(0);
            }}
          >
            <Icon name="close" />
          </button>
        )}
      </div>
      <p className="search-count" aria-live="polite">
        {loading
          ? "Cargando clubes…"
          : query
            ? `${results.length} ${results.length === 1 ? "club encontrado" : "clubes encontrados"}`
            : `${clubs.length} clubes con calendario publicado`}
      </p>
      <ul
        id={`${id}-list`}
        role="listbox"
        aria-label="Clubes"
        className="club-options"
        ref={list}
      >
        {loading &&
          Array.from({ length: 6 }, (_, i) => (
            <li key={i} className="skeleton-row" aria-hidden="true">
              <span className="skeleton" style={{ width: `${40 + ((i * 17) % 40)}%` }} />
            </li>
          ))}
        {results.map((c, i) => (
          <li
            key={c.id}
            id={`${id}-opt-${i}`}
            data-index={i}
            role="option"
            aria-selected={c.id === selectedId}
            className={i === active ? "is-active" : undefined}
            onPointerMove={() => setActive(i)}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onSelect(c)}
          >
            <span className="club-option-name">{c.name}</span>
            <span className="club-option-meta">
              {c.team_count} {c.team_count === 1 ? "equipo" : "equipos"}
            </span>
            {c.id === selectedId && <Icon name="check" />}
          </li>
        ))}
      </ul>
      {!loading && !results.length && (
        <p className="empty-note">
          Ningún club coincide con «{query}». Prueba con una sola palabra, por
          ejemplo la localidad.
        </p>
      )}
    </div>
  );
}
