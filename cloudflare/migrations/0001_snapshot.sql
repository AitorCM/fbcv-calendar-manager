CREATE TABLE cf_snapshots (id TEXT PRIMARY KEY, season TEXT NOT NULL, metadata TEXT NOT NULL);
CREATE TABLE cf_active_snapshot (season TEXT PRIMARY KEY, snapshot_id TEXT NOT NULL);
CREATE TABLE cf_clubs (snapshot_id TEXT NOT NULL, id TEXT NOT NULL, name TEXT NOT NULL, search_name TEXT NOT NULL, team_count INTEGER NOT NULL, PRIMARY KEY(snapshot_id,id));
CREATE TABLE cf_teams (snapshot_id TEXT NOT NULL, club_id TEXT NOT NULL, id TEXT NOT NULL, payload TEXT NOT NULL, PRIMARY KEY(snapshot_id,club_id,id));
CREATE TABLE cf_calendars (snapshot_id TEXT NOT NULL, club_id TEXT NOT NULL, team_id TEXT NOT NULL, payload TEXT NOT NULL, PRIMARY KEY(snapshot_id,club_id,team_id));
CREATE TABLE cf_conflict_meta (snapshot_id TEXT NOT NULL, club_id TEXT NOT NULL, skipped_matches INTEGER NOT NULL, PRIMARY KEY(snapshot_id,club_id));
CREATE TABLE cf_conflicts (snapshot_id TEXT NOT NULL, club_id TEXT NOT NULL, id TEXT NOT NULL, payload TEXT NOT NULL, PRIMARY KEY(snapshot_id,club_id,id));
CREATE TABLE conflict_reviews (season TEXT NOT NULL, club_id TEXT NOT NULL, conflict_id TEXT NOT NULL, resolved INTEGER NOT NULL CHECK(resolved IN(0,1)), note TEXT NOT NULL, reviewed_at TEXT NOT NULL, PRIMARY KEY(season,club_id,conflict_id));
