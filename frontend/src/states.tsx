import { Icon } from "./Icon";

export function ErrorPanel({
  message,
  onRetry,
  action = "Volver a intentar",
}: {
  message: string;
  onRetry: () => void;
  action?: string;
}) {
  return (
    <div className="error-panel" role="alert">
      <Icon name="alert" />
      <p>{message}</p>
      <button className="button secondary" onClick={onRetry}>
        <Icon name="refresh" />
        {action}
      </button>
    </div>
  );
}

export function SkeletonRows({ count = 5 }: { count?: number }) {
  return (
    <div className="skeleton-board" role="status" aria-label="Cargando">
      {Array.from({ length: count }, (_, i) => (
        <div className="skeleton-fixture" key={i} aria-hidden="true">
          <span className="skeleton tile" />
          <span className="skeleton" style={{ width: `${30 + ((i * 23) % 30)}%` }} />
          <span className="skeleton" style={{ width: `${20 + ((i * 11) % 25)}%` }} />
        </div>
      ))}
    </div>
  );
}
