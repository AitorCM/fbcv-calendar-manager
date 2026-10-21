import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const source = await readFile(new URL("../src/ics.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
});
const { teamIcs } = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`
);
const now = new Date("2026-10-08T12:00:00Z");
const match = (id, starts_at, extra = {}) => ({
  id, starts_at, home: true, home_team: "ADESAVI A", away_team: "CB ALBATERA",
  time_confirmed: true, venue: "PABELLÓN MUNICIPAL", town: "Sant Vicent", address: null,
  home_score: null, away_score: null, message: null,
  source_url: "https://www.fbcv.es/competiciones/competicion?id=1", ...extra,
});

test("exports future dated matches, with all-day events when the time is unconfirmed", () => {
  const { count, text } = teamIcs({
    team: { id: "1", name: "ADESAVI A" },
    groups: [{ category: "SÉNIOR", rounds: [{ matches: [
      match("past", "2026-10-01T10:00:00+02:00", { home_score: "70", away_score: "60" }),
      match("timed", "2026-10-25T12:00:00+01:00"),
      match("allday", "2026-11-01T00:00:00+01:00", { time_confirmed: false }),
      match("undated", null),
    ] }] }],
  }, now);
  assert.equal(count, 2);
  assert.match(text, /UID:fbcv-timed@enpista\r\nDTSTAMP:\d{8}T\d{6}Z\r\nDTSTART:20261025T110000Z\r\nDTEND:20261025T123000Z/);
  assert.match(text, /DTSTART;VALUE=DATE:20261101/);
  assert.doesNotMatch(text, /fbcv-past|fbcv-undated/);
  assert.match(text, /LOCATION:PABELLÓN MUNICIPAL\\, Sant Vicent/);
  for (const line of text.split("\r\n"))
    assert.ok(new TextEncoder().encode(line).length <= 75, line);
});
