-- Run only after a successful import. Keep active snapshots and the latest two per season.

-- conflict_reviews is never modified.

DELETE FROM cf_clubs WHERE snapshot_id NOT IN (SELECT snapshot_id FROM cf_active_snapshot)
  AND snapshot_id NOT IN (
    SELECT id FROM (
      SELECT id, ROW_NUMBER() OVER (
        PARTITION BY season ORDER BY json_extract(metadata, '$.updated_at') DESC, id DESC
      ) AS position FROM cf_snapshots
    ) WHERE position <= 2
  );

DELETE FROM cf_teams WHERE snapshot_id NOT IN (SELECT snapshot_id FROM cf_active_snapshot)
  AND snapshot_id NOT IN (
    SELECT id FROM (
      SELECT id, ROW_NUMBER() OVER (
        PARTITION BY season ORDER BY json_extract(metadata, '$.updated_at') DESC, id DESC
      ) AS position FROM cf_snapshots
    ) WHERE position <= 2
  );

DELETE FROM cf_calendars WHERE snapshot_id NOT IN (SELECT snapshot_id FROM cf_active_snapshot)
  AND snapshot_id NOT IN (
    SELECT id FROM (
      SELECT id, ROW_NUMBER() OVER (
        PARTITION BY season ORDER BY json_extract(metadata, '$.updated_at') DESC, id DESC
      ) AS position FROM cf_snapshots
    ) WHERE position <= 2
  );

DELETE FROM cf_conflict_meta WHERE snapshot_id NOT IN (SELECT snapshot_id FROM cf_active_snapshot)
  AND snapshot_id NOT IN (
    SELECT id FROM (
      SELECT id, ROW_NUMBER() OVER (
        PARTITION BY season ORDER BY json_extract(metadata, '$.updated_at') DESC, id DESC
      ) AS position FROM cf_snapshots
    ) WHERE position <= 2
  );

DELETE FROM cf_conflicts WHERE snapshot_id NOT IN (SELECT snapshot_id FROM cf_active_snapshot)
  AND snapshot_id NOT IN (
    SELECT id FROM (
      SELECT id, ROW_NUMBER() OVER (
        PARTITION BY season ORDER BY json_extract(metadata, '$.updated_at') DESC, id DESC
      ) AS position FROM cf_snapshots
    ) WHERE position <= 2
  );

DELETE FROM cf_snapshots WHERE id NOT IN (SELECT snapshot_id FROM cf_active_snapshot)
  AND id NOT IN (
    SELECT id FROM (
      SELECT id, ROW_NUMBER() OVER (
        PARTITION BY season ORDER BY json_extract(metadata, '$.updated_at') DESC, id DESC
      ) AS position FROM cf_snapshots
    ) WHERE position <= 2
  );
