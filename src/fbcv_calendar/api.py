"""Calendar API with club conflict reviews and the built frontend."""

import json
import os
import sqlite3
import unicodedata
from contextlib import contextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field, StrictBool

from .conflicts import detect_conflicts, review_connection, apply_reviews, save_review


class ReviewRequest(BaseModel):
    resolved: StrictBool
    note: str = Field(default="", max_length=1000)


def normalized(value):
    return "".join(
        c
        for c in unicodedata.normalize("NFKD", value or "").lower()
        if not unicodedata.combining(c)
    )


def create_app(db_path=None, static_dir=None, review_path=None):
    app = FastAPI(title="En pista · Calendarios FBCV")
    app.add_middleware(GZipMiddleware, minimum_size=1000)
    path = Path(db_path or os.environ.get("FBCV_DB", "data/fbcv.sqlite3")).resolve()

    reviews = Path(
        review_path
        or os.environ.get("FBCV_REVIEW_DB", path.with_name("reviews.sqlite3"))
    ).resolve()

    @contextmanager
    def connection():
        if not path.is_file():
            raise HTTPException(
                503, "No hay calendarios disponibles. Ejecuta primero el crawler."
            )
        conn = sqlite3.connect(path.as_uri() + "?mode=ro", uri=True, timeout=10)
        conn.row_factory = sqlite3.Row
        conn.create_function("norm", 1, normalized)
        try:
            yield conn
        finally:
            conn.close()

    def team_rows(conn, club, season):
        # Membership is based on active fixtures, not a possibly stale team name.
        return conn.execute(
            """
          WITH memberships AS (
            SELECT home_team_id AS team_id,group_id,id FROM matches WHERE season=? AND active=1 AND home_club_id=?
            UNION ALL
            SELECT away_team_id,group_id,id FROM matches WHERE season=? AND active=1 AND away_club_id=?
          )
          SELECT e.id,e.name,COUNT(DISTINCT m.id) AS match_count,COUNT(DISTINCT m.group_id) AS group_count,
                 GROUP_CONCAT(DISTINCT json_extract(g.payload,'$.nameCategoryRegistered')) AS categories
          FROM memberships m JOIN entities e ON e.id=m.team_id AND e.kind='team' AND e.season=?
          JOIN groups g ON g.id=m.group_id AND g.season=e.season
          GROUP BY e.id,e.name ORDER BY norm(e.name)
        """,
            (season, club, season, club, season),
        ).fetchall()

    @app.get("/api/meta")
    def meta(season: str = Query("2026", pattern=r"^\d{4}$")):
        with connection() as conn:
            row = conn.execute(
                "SELECT finished_at,status FROM runs WHERE season=? AND finished_at IS NOT NULL ORDER BY id DESC LIMIT 1",
                (season,),
            ).fetchone()
            return {
                "season": season,
                "season_label": f"{season}–{int(season) + 1}",
                "updated_at": row["finished_at"] if row else None,
                "status": row["status"] if row else "unavailable",
            }

    @app.get("/api/clubs")
    def clubs(
        season: str = Query("2026", pattern=r"^\d{4}$"),
        q: str = Query("", max_length=100),
    ):
        with connection() as conn:
            return [
                dict(r)
                for r in conn.execute(
                    """
              WITH memberships AS (
                SELECT home_club_id club_id,home_team_id team_id FROM matches WHERE season=? AND active=1
                UNION SELECT away_club_id,away_team_id FROM matches WHERE season=? AND active=1
              )
              SELECT e.id,e.name,COUNT(DISTINCT m.team_id) team_count FROM memberships m
              JOIN entities e ON e.id=m.club_id AND e.kind='club' AND e.season=?
              WHERE instr(norm(e.name),norm(?))>0 GROUP BY e.id,e.name ORDER BY norm(e.name)
            """,
                    (season, season, season, q),
                )
            ]

    @app.get("/api/clubs/{club_id}/teams")
    def teams(club_id: str, season: str = Query("2026", pattern=r"^\d{4}$")):
        with connection() as conn:
            return [dict(row) for row in team_rows(conn, club_id, season)]

    @app.get("/api/clubs/{club_id}/teams/{team_id}/calendar")
    def calendar(
        club_id: str, team_id: str, season: str = Query("2026", pattern=r"^\d{4}$")
    ):
        with connection() as conn:
            team = next(
                (
                    dict(r)
                    for r in team_rows(conn, club_id, season)
                    if r["id"] == team_id
                ),
                None,
            )
            if team is None:
                raise HTTPException(
                    404, "Este equipo no tiene calendario en el club seleccionado."
                )
            fixtures = conn.execute(
                "SELECT group_id,round,payload,starts_at FROM matches WHERE season=? AND active=1 AND (home_team_id=? OR away_team_id=?) ORDER BY starts_at,id",
                (season, team_id, team_id),
            ).fetchall()
            group_ids = set(r["group_id"] for r in fixtures)
            sections = []
            for group_id in group_ids:
                group = conn.execute(
                    "SELECT name,payload FROM groups WHERE season=? AND id=?",
                    (season, group_id),
                ).fetchone()
                info = json.loads(group["payload"])
                rounds = {}
                for row in fixtures:
                    if row["group_id"] != group_id:
                        continue
                    number = row["round"]
                    rnd = rounds.setdefault(
                        number, {"number": number, "matches": [], "rest": False}
                    )
                    data = json.loads(row["payload"])
                    home = str(data.get("idLocalTeam")) == team_id
                    rnd["matches"].append(
                        {
                            "id": str(data["idMatch"]),
                            "home": home,
                            "home_team": data.get("nameLocalTeam"),
                            "away_team": data.get("nameVisitorTeam"),
                            "starts_at": row["starts_at"],
                            "time_confirmed": bool(
                                row["starts_at"] and "T00:00:00" not in row["starts_at"]
                            ),
                            "venue": data.get("nameField"),
                            "town": data.get("nameTown"),
                            "address": data.get("adressField"),
                            "home_score": data.get("localScore"),
                            "away_score": data.get("visitorScore"),
                            "message": data.get("publicMessage"),
                            "source_url": f"https://www.fbcv.es/competiciones/competicion?id={group_id}",
                        }
                    )
                for row in conn.execute(
                    "SELECT round FROM rests WHERE season=? AND group_id=? AND team_id=?",
                    (season, group_id, team_id),
                ):
                    rounds.setdefault(
                        row["round"],
                        {"number": row["round"], "matches": [], "rest": True},
                    )["rest"] = True
                for number, rnd in rounds.items():
                    date = conn.execute(
                        "SELECT nominal_date FROM rounds WHERE season=? AND group_id=? AND number=?",
                        (season, group_id, number),
                    ).fetchone()
                    rnd["nominal_date"] = date[0] if date else None
                sections.append(
                    {
                        "id": group_id,
                        "name": group["name"],
                        "category": info.get("nameCategoryRegistered"),
                        "phase": info.get("competitionName"),
                        "rounds": sorted(
                            rounds.values(), key=lambda r: int(r["number"])
                        ),
                    }
                )
            sections.sort(
                key=lambda g: min(
                    (r["nominal_date"] or "9999" for r in g["rounds"]), default="9999"
                )
            )
            return {"team": team, "groups": sections}

    @app.get("/api/clubs/{club_id}/conflicts")
    def conflicts(club_id: str, season: str = Query("2026", pattern=r"^\d{4}$")):
        with connection() as conn:
            items, skipped = detect_conflicts(conn, season, club_id)
        with review_connection(reviews) as conn:
            apply_reviews(conn, items, season, club_id)
        return {"items": items, "skipped_matches": skipped, "minimum_minutes": 120}

    @app.put("/api/clubs/{club_id}/conflicts/{conflict_id}/review")
    def review(
        club_id: str,
        conflict_id: str,
        body: ReviewRequest,
        season: str = Query("2026", pattern=r"^\d{4}$"),
    ):
        with connection() as conn:
            items, _ = detect_conflicts(conn, season, club_id)
            if not any(item["id"] == conflict_id for item in items):
                raise HTTPException(
                    404,
                    "La incidencia ya no existe con este horario. Actualiza la lista.",
                )
        with review_connection(reviews) as conn:
            return save_review(
                conn, season, club_id, conflict_id, body.resolved, body.note.strip()
            )

    static = Path(static_dir or os.environ.get("FBCV_STATIC", "frontend/dist"))
    if static.is_dir():
        app.mount("/", StaticFiles(directory=static, html=True), name="frontend")
    return app


app = create_app()
