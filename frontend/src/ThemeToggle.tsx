import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const [dark, setDark] = useState(
    document.documentElement.dataset.theme === "dark",
  );
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", dark ? "#101b28" : "#16324b");
  }, [dark]);
  function toggle() {
    const next = !dark;
    setDark(next);
    try {
      localStorage.setItem("fbcv-theme", next ? "dark" : "light");
    } catch {
      /* The theme still works when browser storage is unavailable. */
    }
  }
  return (
    <button
      className="theme-toggle"
      onClick={toggle}
      aria-pressed={dark}
      aria-label={dark ? "Activar tema claro" : "Activar tema oscuro"}
      title={dark ? "Activar tema claro" : "Activar tema oscuro"}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        {dark ? (
          <>
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" />
          </>
        ) : (
          <path d="M20.5 14A9 9 0 0 1 10 3.5 9 9 0 1 0 20.5 14Z" />
        )}
      </svg>
      <span>{dark ? "Tema claro" : "Tema oscuro"}</span>
    </button>
  );
}
