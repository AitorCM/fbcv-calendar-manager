"""HTTP contracts for club membership and calendars across phases.
Catches cross-club leakage, mixing identically numbered rounds and losing rests.
"""

import copy
import json
import tempfile
import unittest
from pathlib import Path

from fastapi.testclient import TestClient
from fbcv_calendar.api import create_app
from fbcv_calendar.store import Store

FIXTURE = json.loads(Path(__file__).with_name("schedule.json").read_text())


class CalendarApiContracts(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.path = Path(self.tmp.name) / "calendar.sqlite3"
        self.store = Store(self.path)
        run = self.store.start("2026")
        first = copy.deepcopy(FIXTURE)
        first["rounds"]["1"]["matches"]["65180"]["idField"] = "100"
        first["totalRounds"] = 2
        first["rounds"]["2"] = {"date": "2026-10-18", "matches": {}}
        first["rest"]["2"] = {"10318": "FERRETERIA ESCRIG CE GRAU CS A"}
        self.store.group(
            "2026",
            {
                "idGroup": "2601",
                "nameGrupCompetition": "Liga · Gr A",
                "nameCategoryRegistered": "Senior",
            },
        )
        self.store.save_schedule(run, "2026", "2601", first)
        second = copy.deepcopy(FIXTURE)
        second["rounds"]["1"]["matches"]["65180"]["idField"] = "100"
        second["group"]["idGroup"] = "2602"
        match = second["rounds"]["1"]["matches"].pop("65180")
        match.update({"idMatch": "65181", "idGroup": "2602"})
        second["rounds"]["1"]["matches"]["65181"] = match
        self.store.group(
            "2026",
            {
                "idGroup": "2602",
                "nameGrupCompetition": "Copa · Gr A",
                "nameCategoryRegistered": "Senior",
            },
        )
        self.store.save_schedule(run, "2026", "2602", second)
        with self.store.db:
            self.store.db.execute(
                "UPDATE entities SET name='Club Básquet Norte' WHERE kind='club' AND id='1715'"
            )
        self.client = TestClient(
            create_app(self.path, Path(self.tmp.name) / "no-static")
        )

    def tearDown(self):
        self.client.close()
        self.store.db.close()
        self.tmp.cleanup()

    def change_match(self, **changes):
        row = self.store.db.execute(
            "SELECT payload FROM matches WHERE id='65181'"
        ).fetchone()
        data = json.loads(row[0])
        data.update(idLocalTeam="10319", nameLocalTeam="Segundo equipo")
        data.update(changes.pop("payload", {}))
        with self.store.db:
            self.store.db.execute(
                "UPDATE matches SET home_team_id=?,starts_at=?,payload=?,active=?,home_club_id=? WHERE id='65181'",
                (
                    changes.get("team", "10319"),
                    changes.get("starts_at", "2026-10-15T21:00:00+02:00"),
                    json.dumps(data),
                    changes.get("active", 1),
                    changes.get("club", "1715"),
                ),
            )

    def test_conflict_detection_obeys_time_venue_and_club_boundaries(self):
        # HTTP boundary: two different team IDs even when names/categories overlap.
        cases = [
            ({}, [0]),
            ({"starts_at": "2026-10-15T22:59:00+02:00"}, [119]),
            ({"starts_at": "2026-10-15T23:00:00+02:00"}, []),
            ({"starts_at": "2026-10-16T21:00:00+02:00"}, []),
            ({"starts_at": "2026-10-15T00:00:00+02:00"}, []),
            ({"team": "10318"}, []),
            ({"club": "other"}, []),
            ({"active": 0}, []),
            ({"payload": {"idField": "different"}}, []),
        ]
        for changes, expected in cases:
            with self.subTest(changes=changes):
                self.change_match(payload={"idField": "100"})
                # Both fixtures use one facility as a controlled scheduling input.
                with self.store.db:
                    self.store.db.execute(
                        "UPDATE matches SET payload=json_set(payload,'$.idField','100') WHERE id='65180'"
                    )
                self.change_match(**changes)
                response = self.client.get("/api/clubs/1715/conflicts")
                self.assertEqual(response.status_code, 200)
                self.assertEqual(
                    [c["gap_minutes"] for c in response.json()["items"]], expected
                )

    def test_reviews_persist_are_club_scoped_and_reset_for_changed_schedules(self):
        self.change_match()
        route = "/api/clubs/1715/conflicts"
        original = self.client.get(route).json()["items"][0]
        review_url = f"{route}/{original['id']}/review"
        response = self.client.put(
            review_url, json={"resolved": True, "note": "Dos pistas"}
        )
        self.assertEqual(response.status_code, 200)
        # Another app/connection sees the persisted review; not a local React flag.
        with TestClient(create_app(self.path, Path(self.tmp.name) / "none")) as other:
            saved = other.get(route).json()["items"][0]
            self.assertTrue(saved["resolved"])
            self.assertEqual(saved["note"], "Dos pistas")
        self.assertEqual(
            self.client.put(
                f"/api/clubs/920/conflicts/{original['id']}/review",
                json={"resolved": True},
            ).status_code,
            404,
        )
        self.assertEqual(
            self.client.put(review_url, json={"resolved": "yes"}).status_code, 422
        )
        with self.store.db:
            self.store.db.execute(
                "UPDATE matches SET payload=json_set(payload,'$.localScore',42) WHERE id='65181'"
            )
        self.assertTrue(self.client.get(route).json()["items"][0]["resolved"])
        self.change_match(starts_at="2026-10-15T21:30:00+02:00")
        changed = self.client.get(route).json()["items"][0]
        self.assertNotEqual(changed["id"], original["id"])
        self.assertFalse(changed["resolved"])
        self.assertEqual(changed["note"], "")
        self.assertEqual(
            self.client.put(review_url, json={"resolved": True}).status_code, 404
        )
        url = f"{route}/{changed['id']}/review"
        self.assertEqual(self.client.put(url, json={"resolved": True}).status_code, 200)
        self.assertEqual(
            self.client.put(url, json={"resolved": False}).status_code, 200
        )
        self.assertFalse(self.client.get(route).json()["items"][0]["resolved"])

    def test_search_and_membership_only_return_the_selected_club(self):
        response = self.client.get("/api/clubs", params={"q": "basquet"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json(),
            [{"id": "1715", "name": "Club Básquet Norte", "team_count": 1}],
        )
        teams = self.client.get("/api/clubs/1715/teams").json()
        self.assertEqual([t["id"] for t in teams], ["10318"])
        self.assertEqual(teams[0]["match_count"], 2)
        self.assertEqual(
            self.client.get("/api/clubs/920/teams/10318/calendar").status_code, 404
        )
        self.assertEqual(
            self.client.get(
                "/api/clubs", params={"season": "2026' OR 1=1"}
            ).status_code,
            422,
        )

    def test_round_numbers_stay_separate_and_rests_are_visible(self):
        response = self.client.get("/api/clubs/1715/teams/10318/calendar")
        self.assertEqual(response.status_code, 200)
        groups = {g["id"]: g for g in response.json()["groups"]}
        self.assertEqual(set(groups), {"2601", "2602"})
        self.assertEqual([r["number"] for r in groups["2601"]["rounds"]], ["1", "2"])
        self.assertEqual(groups["2601"]["rounds"][1]["rest"], True)
        self.assertEqual(groups["2601"]["rounds"][1]["matches"], [])
        self.assertEqual(groups["2602"]["rounds"][0]["matches"][0]["id"], "65181")
        match = groups["2601"]["rounds"][0]["matches"][0]
        self.assertEqual(match["starts_at"], "2026-10-15T21:00:00+02:00")
        self.assertTrue(match["home"])
