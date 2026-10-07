"""Possible venue clashes and durable, club-scoped reviews of exact schedules."""

import hashlib
import json
import sqlite3
from collections import defaultdict
from contextlib import contextmanager
from datetime import datetime, timezone
from zoneinfo import ZoneInfo


def detect_conflicts(conn, season, club):
    slots = defaultdict(list)
    skipped = 0
    rows = conn.execute(
        "SELECT * FROM matches WHERE season=? AND active=1 AND (home_club_id=? OR away_club_id=?)",
        (season, club, club),
    )
    for row in rows:
        data = json.loads(row["payload"])
        stamp = row["starts_at"]
        if not stamp or not data.get("idField") or str(data["idField"]) == "0":
            skipped += 1
            continue
        time = datetime.fromisoformat(stamp).astimezone(ZoneInfo("Europe/Madrid"))
        if time.hour == time.minute == 0:
            skipped += 1
            continue
        team_ids = [
            row[f"{side}_team_id"]
            for side in ("home", "away")
            if row[f"{side}_club_id"] == club and row[f"{side}_team_id"]
        ]
        match = {
            "id": row["id"],
            "starts_at": time.isoformat(),
            "team_ids": team_ids,
            "home_team": data.get("nameLocalTeam"),
            "away_team": data.get("nameVisitorTeam"),
            "category": data.get("nameCategory"),
            "round": row["round"],
            "source_url": f"https://www.fbcv.es/competiciones/competicion?id={row['group_id']}",
        }
        slots[(str(data["idField"]), time.date().isoformat())].append(
            (time, match, data)
        )
    results = []
    for (field, date), games in slots.items():
        games.sort(key=lambda game: (game[0], game[1]["id"]))
        for i, (start, a, data) in enumerate(games):
            for end, b, _ in games[i + 1 :]:
                seconds = end.timestamp() - start.timestamp()
                if seconds >= 7200:
                    break
                if not any(x != y for x in a["team_ids"] for y in b["team_ids"]):
                    continue
                # Review identity changes only with relevant scheduling facts, not scores.
                identity = [
                    season,
                    club,
                    field,
                    sorted(
                        [
                            (m["id"], m["starts_at"], sorted(m["team_ids"]))
                            for m in (a, b)
                        ]
                    ),
                ]
                key = hashlib.sha256(
                    json.dumps(identity, separators=(",", ":")).encode()
                ).hexdigest()
                results.append(
                    {
                        "id": key,
                        "date": date,
                        "field_id": field,
                        "venue": data.get("nameField"),
                        "town": data.get("nameTown"),
                        "gap_minutes": seconds / 60,
                        "kind": "simultaneous" if seconds == 0 else "short_gap",
                        "matches": [a, b],
                        "resolved": False,
                        "note": "",
                        "reviewed_at": None,
                    }
                )
    results.sort(
        key=lambda item: (item["date"], item["matches"][0]["starts_at"], item["id"])
    )
    return results, skipped


@contextmanager
def review_connection(path):
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path, timeout=10)
    conn.row_factory = sqlite3.Row
    try:
        version = conn.execute("PRAGMA user_version").fetchone()[0]
        if version not in (0, 1):
            raise RuntimeError("Versión de base de revisiones no compatible")
        conn.execute("PRAGMA journal_mode=WAL")
        with conn:
            conn.execute("""CREATE TABLE IF NOT EXISTS conflict_reviews (
                season TEXT NOT NULL, club_id TEXT NOT NULL, conflict_id TEXT NOT NULL,
                resolved INTEGER NOT NULL CHECK(resolved IN (0,1)), note TEXT NOT NULL,
                reviewed_at TEXT NOT NULL, PRIMARY KEY(season,club_id,conflict_id))""")
            conn.execute("PRAGMA user_version=1")
        yield conn
    finally:
        conn.close()


def apply_reviews(conn, conflicts, season, club):
    saved = {
        row["conflict_id"]: row
        for row in conn.execute(
            "SELECT * FROM conflict_reviews WHERE season=? AND club_id=?",
            (season, club),
        )
    }
    for item in conflicts:
        if row := saved.get(item["id"]):
            item.update(
                resolved=bool(row["resolved"]),
                note=row["note"],
                reviewed_at=row["reviewed_at"],
            )


def save_review(conn, season, club, conflict_id, resolved, note):
    stamp = datetime.now(timezone.utc).isoformat()
    with conn:
        conn.execute(
            """INSERT INTO conflict_reviews VALUES(?,?,?,?,?,?)
            ON CONFLICT(season,club_id,conflict_id) DO UPDATE SET
            resolved=excluded.resolved,note=excluded.note,reviewed_at=excluded.reviewed_at""",
            (season, club, conflict_id, int(resolved), note, stamp),
        )
    return {"id": conflict_id, "resolved": resolved, "note": note, "reviewed_at": stamp}
