"""SQLite storage. Only validated group responses replace published schedules."""

import hashlib
import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from zoneinfo import ZoneInfo


def now():
    return datetime.now(timezone.utc).isoformat()


def encode(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True)


MATCH_FIELDS = (
    "idMatch",
    "idMatchCall",
    "season",
    "idLocalClub",
    "nameLocalTeamOrganization",
    "idVisitorClub",
    "nameVisitorTeamOrganization",
    "idLocalTeam",
    "nameLocalTeam",
    "idVisitorTeam",
    "nameVisitorTeam",
    "idGroup",
    "numMatchDay",
    "matchDay",
    "state",
    "idField",
    "nameField",
    "adressField",
    "postalCodeField",
    "nameTown",
    "localScore",
    "visitorScore",
    "publicMessage",
    "nameCompetition",
    "nameCategory",
)


def validate_schedule(data, season, group_id):
    if not isinstance(data, dict) or not isinstance(data.get("rounds"), dict):
        raise ValueError("Respuesta sin jornadas verificables")
    if str(data.get("group", {}).get("season")) != season:
        raise ValueError("Temporada inesperada en calendario")
    if str(data["group"].get("idGroup")) != group_id:
        raise ValueError("Grupo inesperado en calendario")
    expected = int(data["totalRounds"])
    if len(data["rounds"]) != expected:
        raise ValueError(f"Jornadas incompletas: {len(data['rounds'])}/{expected}")
    matches = []
    seen = set()
    for number, rnd in data["rounds"].items():
        if not isinstance(rnd.get("matches"), dict):
            raise ValueError("Formato de partidos inesperado")
        for match in rnd["matches"].values():
            if (
                not match.get("idMatch")
                or str(match.get("season")) != season
                or str(match.get("idGroup")) != group_id
            ):
                raise ValueError("Partido sin identidad o fuera de alcance")
            key = str(match["idMatch"])
            if key in seen:
                raise ValueError("Identificador de partido repetido")
            seen.add(key)
            row = {k: match.get(k) for k in MATCH_FIELDS}
            row["round"] = str(number)
            day = match.get("matchDay")
            row["starts_at"] = None
            if day:
                parsed = datetime.fromisoformat(day)
                if len(day) > 10:
                    row["starts_at"] = (
                        parsed.replace(tzinfo=ZoneInfo("Europe/Madrid"))
                        if parsed.tzinfo is None
                        else parsed.astimezone(ZoneInfo("Europe/Madrid"))
                    ).isoformat()
            matches.append(row)
    return matches


class Store:
    def __init__(self, path):
        Path(path).parent.mkdir(parents=True, exist_ok=True)
        self.db = sqlite3.connect(path, timeout=30)
        self.db.execute("PRAGMA journal_mode=WAL")
        self.db.execute("PRAGMA foreign_keys=ON")
        self.db.executescript("""
        CREATE TABLE IF NOT EXISTS schema_version(version INTEGER PRIMARY KEY);
        INSERT OR IGNORE INTO schema_version VALUES(1);
        CREATE TABLE IF NOT EXISTS runs(id INTEGER PRIMARY KEY, season TEXT NOT NULL, started_at TEXT NOT NULL,
          finished_at TEXT, status TEXT NOT NULL, report TEXT);
        CREATE TABLE IF NOT EXISTS entities(season TEXT, kind TEXT, id TEXT, name TEXT, payload TEXT,
          PRIMARY KEY(season,kind,id));
        CREATE TABLE IF NOT EXISTS discovery(run_id INTEGER REFERENCES runs(id), kind TEXT, id TEXT,
          parent_kind TEXT, parent_id TEXT, PRIMARY KEY(run_id,kind,id,parent_kind,parent_id));
        CREATE TABLE IF NOT EXISTS groups(season TEXT, id TEXT, name TEXT, category_id TEXT, payload TEXT,
          last_success_run INTEGER REFERENCES runs(id), PRIMARY KEY(season,id));
        CREATE TABLE IF NOT EXISTS matches(season TEXT, id TEXT, group_id TEXT, round TEXT,
          home_club_id TEXT, away_club_id TEXT, home_team_id TEXT, away_team_id TEXT,
          starts_at TEXT, payload TEXT NOT NULL, hash TEXT NOT NULL, first_seen TEXT, last_seen TEXT,
          active INTEGER NOT NULL DEFAULT 1, PRIMARY KEY(season,id),
          FOREIGN KEY(season,group_id) REFERENCES groups(season,id));
        CREATE INDEX IF NOT EXISTS home_club ON matches(season,home_club_id,starts_at);
        CREATE INDEX IF NOT EXISTS away_club ON matches(season,away_club_id,starts_at);
        CREATE TABLE IF NOT EXISTS match_changes(id INTEGER PRIMARY KEY, season TEXT, match_id TEXT,
          run_id INTEGER REFERENCES runs(id), changed_at TEXT, previous TEXT, current TEXT);
        CREATE TABLE IF NOT EXISTS rounds(season TEXT, group_id TEXT, number TEXT, nominal_date TEXT,
          PRIMARY KEY(season,group_id,number), FOREIGN KEY(season,group_id) REFERENCES groups(season,id));
        CREATE TABLE IF NOT EXISTS rests(season TEXT, group_id TEXT, round TEXT, team_id TEXT, team_name TEXT,
          PRIMARY KEY(season,group_id,round,team_id), FOREIGN KEY(season,group_id) REFERENCES groups(season,id));
        CREATE TABLE IF NOT EXISTS group_runs(run_id INTEGER REFERENCES runs(id), group_id TEXT, status TEXT,
          rounds INTEGER, matches INTEGER, error TEXT, PRIMARY KEY(run_id,group_id));
        """)
        self.db.commit()

    def start(self, season):
        with self.db:
            return self.db.execute(
                "INSERT INTO runs(season,started_at,status) VALUES(?,?,?)",
                (season, now(), "running"),
            ).lastrowid

    def entity(
        self,
        season,
        kind,
        id_,
        name,
        payload,
        run_id=None,
        parent_kind="",
        parent_id="",
    ):
        self.db.execute(
            "INSERT INTO entities VALUES(?,?,?,?,?) ON CONFLICT(season,kind,id) DO UPDATE SET name=excluded.name,payload=excluded.payload",
            (season, kind, str(id_), name, encode(payload)),
        )
        if run_id:
            self.db.execute(
                "INSERT OR IGNORE INTO discovery VALUES(?,?,?,?,?)",
                (run_id, kind, str(id_), parent_kind, str(parent_id)),
            )

    def group(self, season, value):
        with self.db:
            self.db.execute(
                "INSERT INTO groups(season,id,name,category_id,payload) VALUES(?,?,?,?,?) ON CONFLICT(season,id) DO UPDATE SET name=excluded.name,category_id=excluded.category_id,payload=excluded.payload",
                (
                    season,
                    str(value["idGroup"]),
                    value.get("nameGrupCompetition"),
                    str(value.get("idCategoryRegistered")),
                    encode(value),
                ),
            )

    def save_schedule(self, run_id, season, group_id, data):
        matches = validate_schedule(data, season, group_id)
        stamp = now()
        with self.db:
            self.db.execute(
                "UPDATE matches SET active=0 WHERE season=? AND group_id=?",
                (season, group_id),
            )
            self.db.execute(
                "DELETE FROM rounds WHERE season=? AND group_id=?", (season, group_id)
            )
            self.db.execute(
                "DELETE FROM rests WHERE season=? AND group_id=?", (season, group_id)
            )
            for number, rnd in data["rounds"].items():
                self.db.execute(
                    "INSERT INTO rounds VALUES(?,?,?,?)",
                    (season, group_id, str(number), rnd.get("date")),
                )
            for number, teams in (data.get("rest") or {}).items():
                if teams == [] or teams is None:
                    continue
                if not isinstance(teams, dict):
                    raise ValueError("Formato de descansos inesperado")
                for id_, name in teams.items():
                    self.db.execute(
                        "INSERT INTO rests VALUES(?,?,?,?,?)",
                        (season, group_id, str(number), str(id_), name),
                    )
                    # A rest supplies no club relation; keep richer match evidence.
                    known = self.db.execute(
                        "SELECT 1 FROM entities WHERE season=? AND kind='team' AND id=?",
                        (season, str(id_)),
                    ).fetchone()
                    if not known:
                        self.entity(
                            season, "team", id_, name, {"id": str(id_), "name": name}
                        )
            for match in matches:
                id_ = str(match["idMatch"])
                body = encode(match)
                digest = hashlib.sha256(body.encode()).hexdigest()
                previous = self.db.execute(
                    "SELECT payload,hash FROM matches WHERE season=? AND id=?",
                    (season, id_),
                ).fetchone()
                if previous and previous[1] != digest:
                    self.db.execute(
                        "INSERT INTO match_changes(season,match_id,run_id,changed_at,previous,current) VALUES(?,?,?,?,?,?)",
                        (season, id_, run_id, stamp, previous[0], body),
                    )
                for side in ("Local", "Visitor"):
                    club = match.get(f"id{side}Club")
                    team = match.get(f"id{side}Team")
                    if club is not None:
                        self.entity(
                            season,
                            "club",
                            club,
                            match.get(f"name{side}TeamOrganization"),
                            {"id": str(club)},
                        )
                    if team is not None:
                        self.entity(
                            season,
                            "team",
                            team,
                            match.get(f"name{side}Team"),
                            {
                                "id": str(team),
                                "club_id": str(club) if club is not None else None,
                            },
                        )
                self.db.execute(
                    """INSERT INTO matches VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,1)
                  ON CONFLICT(season,id) DO UPDATE SET group_id=excluded.group_id,round=excluded.round,
                  home_club_id=excluded.home_club_id,away_club_id=excluded.away_club_id,
                  home_team_id=excluded.home_team_id,away_team_id=excluded.away_team_id,
                  starts_at=excluded.starts_at,payload=excluded.payload,hash=excluded.hash,last_seen=excluded.last_seen,active=1""",
                    (
                        season,
                        id_,
                        group_id,
                        match["round"],
                        match["idLocalClub"],
                        match["idVisitorClub"],
                        match["idLocalTeam"],
                        match["idVisitorTeam"],
                        match["starts_at"],
                        body,
                        digest,
                        stamp,
                        stamp,
                    ),
                )
            self.db.execute(
                "UPDATE groups SET last_success_run=? WHERE season=? AND id=?",
                (run_id, season, group_id),
            )
            self.db.execute(
                "INSERT OR REPLACE INTO group_runs VALUES(?,?,?,?,?,NULL)",
                (
                    run_id,
                    group_id,
                    "empty" if not matches else "complete",
                    len(data["rounds"]),
                    len(matches),
                ),
            )
        return len(matches)

    def fail_group(self, run_id, group_id, error):
        with self.db:
            self.db.execute(
                "INSERT OR REPLACE INTO group_runs VALUES(?,?,?,NULL,NULL,?)",
                (run_id, group_id, "failed", error),
            )

    def finish(self, run_id, report):
        with self.db:
            self.db.execute(
                "UPDATE runs SET finished_at=?,status=?,report=? WHERE id=?",
                (now(), report["status"], encode(report), run_id),
            )

    def export(self, path, season, club=None):
        query = "SELECT payload FROM matches WHERE season=? AND active=1"
        args = [season]
        if club:
            query += " AND (home_club_id=? OR away_club_id=?)"
            args += [club, club]
        query += " ORDER BY starts_at,id"
        Path(path).parent.mkdir(parents=True, exist_ok=True)
        with open(path, "w") as out:
            for (payload,) in self.db.execute(query, args):
                out.write(payload + "\n")
