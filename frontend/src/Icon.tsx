// One authored icon set: 20px grid, 1.75 stroke, round joins.
const PATHS = {
  search: <><circle cx="9" cy="9" r="5.5" /><path d="m13 13 4.5 4.5" /></>,
  close: <path d="m5 5 10 10M15 5 5 15" />,
  check: <path d="m4.5 10.5 3.5 3.5 7.5-8" />,
  "chevron-down": <path d="m5.5 8 4.5 4.5L14.5 8" />,
  "chevron-right": <path d="m8 5.5 4.5 4.5L8 14.5" />,
  "chevron-left": <path d="M12 5.5 7.5 10l4.5 4.5" />,
  star: <path d="m10 2.8 2.2 4.6 5 .7-3.6 3.5.9 5-4.5-2.4-4.5 2.4.9-5L2.8 8.1l5-.7Z" />,
  pin: <><path d="M10 17.5s5.5-5.2 5.5-9.3a5.5 5.5 0 0 0-11 0c0 4.1 5.5 9.3 5.5 9.3Z" /><circle cx="10" cy="8.2" r="2" /></>,
  external: <path d="M8.5 4.5h-4v11h11v-4M11.5 3.5h5v5M16.5 3.5 9 11" />,
  "calendar-plus": <><rect x="3" y="4.5" width="14" height="12" rx="2" /><path d="M3 8.5h14M7 2.8v3.4M13 2.8v3.4M10 10.5v4M8 12.5h4" /></>,
  sun: <><circle cx="10" cy="10" r="3.2" /><path d="M10 2.5v1.8M10 15.7v1.8M2.5 10h1.8M15.7 10h1.8M4.7 4.7l1.3 1.3M14 14l1.3 1.3M4.7 15.3 6 14M14 6l1.3-1.3" /></>,
  moon: <path d="M16.5 12.3A7 7 0 0 1 7.7 3.5a7 7 0 1 0 8.8 8.8Z" />,
  refresh: <path d="M16 10a6 6 0 1 1-1.8-4.3M16 3.5v3.7h-3.7" />,
  alert: <><path d="M10 3 2.5 16.5h15Z" /><path d="M10 8.5v3.5M10 14.3v.2" /></>,
  swap: <path d="M4 7h11.5l-3-3M16 13H4.5l3 3" />,
  list: <path d="M7 5.5h9.5M7 10h9.5M7 14.5h9.5M3.5 5.5h.01M3.5 10h.01M3.5 14.5h.01" />,
  clock: <><circle cx="10" cy="10" r="7" /><path d="M10 6v4l2.5 2" /></>,
  note: <path d="M4 3.5h12v9l-4 4H4Z M12 16.5v-4h4" />,
};

export type IconName = keyof typeof PATHS;

export function Icon({ name, filled = false }: { name: IconName; filled?: boolean }) {
  return (
    <svg
      className={`icon${filled ? " is-filled" : ""}`}
      viewBox="0 0 20 20"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  );
}

export function BrandMark() {
  return (
    <svg className="brand-mark" viewBox="0 0 32 32" aria-hidden="true">
      <circle cx="16" cy="16" r="13" />
      <path d="M3 16h26M16 3v26M7 7.5c6 3 8.5 7.5 9 8.5s3 5.5 9 8.5M25 7.5c-6 3-8.5 7.5-9 8.5s-3 5.5-9 8.5" />
    </svg>
  );
}
