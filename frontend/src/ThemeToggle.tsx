import { useEffect, useState } from "react";
import { Icon } from "./Icon";

export default function ThemeToggle() {
  const [dark, setDark] = useState(
    document.documentElement.dataset.theme === "dark",
  );
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
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
  const label = dark ? "Usar tema claro" : "Usar tema oscuro";
  return (
    <button
      className="icon-button on-shell"
      onClick={toggle}
      aria-label={label}
      title={label}
    >
      <Icon name={dark ? "sun" : "moon"} />
    </button>
  );
}
