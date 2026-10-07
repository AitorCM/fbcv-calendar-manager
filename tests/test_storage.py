"""Contracts: source dates, idempotent refresh, atomic failure and exports.
Real public schedule excerpt; expected dates independent of production parser.
"""

import base64
import copy
import json
import tempfile
import unittest
from pathlib import Path

from fbcv_calendar.crawler import decode_response, confirmed_empty_schedule
from fbcv_calendar.store import Store

FIXTURE = json.loads(Path(__file__).with_name("schedule.json").read_text())


class StorageContracts(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.store = Store(Path(self.tmp.name) / "calendar.sqlite3")
        self.run = self.store.start("2026")
        self.store.group("2026", {"idGroup": "2601", "idCategoryRegistered": "409"})

    def tearDown(self):
        self.store.db.close()
        self.tmp.cleanup()

    def test_refresh_preserves_identity_and_tracks_actual_match_time(self):
        self.store.save_schedule(self.run, "2026", "2601", FIXTURE)
        self.store.save_schedule(self.run, "2026", "2601", FIXTURE)
        changed = copy.deepcopy(FIXTURE)
        changed["rounds"]["1"]["matches"]["65180"]["matchDay"] = "2026-10-28 20:00:00"
        self.store.save_schedule(self.run, "2026", "2601", changed)
        rows = self.store.db.execute(
            "SELECT id,starts_at,active FROM matches"
        ).fetchall()
        self.assertEqual(rows, [("65180", "2026-10-28T20:00:00+01:00", 1)])
        previous, current = self.store.db.execute(
            "SELECT previous,current FROM match_changes"
        ).fetchone()
        self.assertEqual(json.loads(previous)["starts_at"], "2026-10-15T21:00:00+02:00")
        self.assertEqual(json.loads(current)["starts_at"], rows[0][1])
        self.assertEqual(
            self.store.db.execute("SELECT nominal_date FROM rounds").fetchone()[0],
            "2026-10-09",
        )
        output = Path(self.tmp.name) / "club.jsonl"
        self.store.export(output, "2026", "1715")
        self.assertEqual(len(output.read_text().splitlines()), 1)
        self.store.export(output, "2026", "nonexistent")
        self.assertEqual(output.read_text(), "")

    def test_invalid_capture_cannot_replace_a_valid_schedule(self):
        self.store.save_schedule(self.run, "2026", "2601", FIXTURE)
        before = self.store.db.execute("SELECT * FROM matches").fetchall()
        invalids = []
        missing_round = copy.deepcopy(FIXTURE)
        missing_round["totalRounds"] = 2
        invalids.append(missing_round)
        wrong_season = copy.deepcopy(FIXTURE)
        wrong_season["group"]["season"] = "2025"
        invalids.append(wrong_season)
        malformed = copy.deepcopy(FIXTURE)
        malformed["rounds"]["1"]["matches"]["65180"]["matchDay"] = "invalid"
        invalids.append(malformed)
        for invalid in invalids:
            with self.subTest(invalid=invalid):
                with self.assertRaises(ValueError):
                    self.store.save_schedule(self.run, "2026", "2601", invalid)
                self.assertEqual(
                    self.store.db.execute("SELECT * FROM matches").fetchall(), before
                )

    def test_rest_only_capture_preserves_known_team_club(self):
        self.store.save_schedule(self.run, "2026", "2601", FIXTURE)
        self.store.group("2026", {"idGroup": "2602", "idCategoryRegistered": "409"})
        resting = {
            "group": {"season": "2026", "idGroup": "2602"},
            "totalRounds": 1,
            "rounds": {"1": {"date": "2026-10-09", "matches": {}}},
            "rest": {"1": {"10318": "FERRETERIA ESCRIG CE GRAU CS A"}},
        }
        self.store.save_schedule(self.run, "2026", "2602", resting)
        (payload,) = self.store.db.execute(
            "SELECT payload FROM entities WHERE kind='team' AND id='10318'"
        ).fetchone()
        self.assertEqual(json.loads(payload)["club_id"], "1715")

    def test_calendar_with_empty_rest_array_is_saved(self):
        schedule = copy.deepcopy(FIXTURE)
        # Observed source format in groups 2602 and 2596.
        schedule["rest"] = {"1": []}
        count = self.store.save_schedule(self.run, "2026", "2601", schedule)
        self.assertEqual(count, 1)
        self.assertEqual(
            self.store.db.execute(
                "SELECT COUNT(*) FROM matches WHERE active=1"
            ).fetchone()[0],
            1,
        )
        self.assertEqual(
            self.store.db.execute("SELECT COUNT(*) FROM rests").fetchone()[0], 0
        )

    def test_empty_fallback_requires_explicit_zero_rounds(self):
        for data in (
            {"totalRounds": 1},
            {"totalRounds": 0, "playoffs": [{"id": "1"}]},
            {},
        ):
            with self.subTest(data=data), self.assertRaises(ValueError):
                confirmed_empty_schedule(data)
        source = {"group": {"idGroup": "2601", "season": "2026"}, "totalRounds": 0}
        self.assertEqual(
            self.store.save_schedule(
                self.run, "2026", "2601", confirmed_empty_schedule(source)
            ),
            0,
        )
        self.assertEqual(
            self.store.db.execute(
                "SELECT status FROM group_runs WHERE run_id=?", (self.run,)
            ).fetchone()[0],
            "empty",
        )

    def test_source_envelope_rejects_error_even_with_http_success(self):
        raw = base64.b64encode(
            json.dumps({"result": "ERROR", "messageData": []}).encode()
        )
        with self.assertRaises(ValueError):
            decode_response(raw)
        success = base64.b64encode(
            json.dumps({"result": "OK", "messageData": FIXTURE}).encode()
        )
        self.assertEqual(decode_response(success), FIXTURE)


if __name__ == "__main__":
    unittest.main()
