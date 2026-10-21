import SevenSeg from "./SevenSeg";
import { clock, dayWithWeekday, outcome, type Match } from "./api";

/** The scoreboard cell: kick-off time, or the final score once played. */
export default function TimeTile({
  match: m,
  showDate = false,
  size = "md",
}: {
  match: Match;
  showDate?: boolean;
  size?: "sm" | "md";
}) {
  const result = outcome(m);
  if (result) {
    const own = m.home ? m.home_score : m.away_score;
    const other = m.home ? m.away_score : m.home_score;
    const word =
      result === "win" ? "Victoria" : result === "loss" ? "Derrota" : "Empate";
    return (
      <div className={`time-tile is-result is-${result} tile-${size}`}>
        <span className="tile-label">{word}</span>
        <SevenSeg
          value={`${own}-${other}`}
          label={`${word} ${own} a ${other}`}
          size={size}
        />
      </div>
    );
  }
  const confirmed = !!m.starts_at && m.time_confirmed;
  return (
    <div className={`time-tile tile-${size}${confirmed ? "" : " is-pending"}`}>
      {(showDate || !confirmed) && (
        <span className="tile-label">
          {showDate && m.starts_at ? dayWithWeekday(m.starts_at) : "Por confirmar"}
        </span>
      )}
      <SevenSeg
        value={confirmed ? clock(m.starts_at!) : "--:--"}
        label={confirmed ? clock(m.starts_at!) : "Hora por confirmar"}
        size={size}
      />
    </div>
  );
}
