import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const source = await readFile(new URL("../src/upcoming.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext },
});
const { upcomingMatches } = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`
);
const now = Date.parse("2026-10-08T12:00:00Z");
const match = (id, starts_at, extra = {}) => ({
  id, starts_at, home_score: null, away_score: null, ...extra,
});
const calendar = (name, category, matches = []) => ({
  team: { id: name, name, categories: category },
  groups: [{ category, rounds: [{ matches }] }],
});

test("shows categories oldest first, with accents, gender and alphabetical team ties", () => {
  const data = [
    calendar("Benjamín", "BENJAMÍN MIXTO"),
    calendar("Cadete", "CADETE MASCULINO"),
    calendar("Senior B", "SÉNIOR FEMENINO"),
    calendar("Alevín", "ALEVÍN"),
    calendar("Infantil", "INFANTIL"),
    calendar("Junior", "JÚNIOR"),
    calendar("Senior A", "SENIOR MASCULINO"),
    calendar("División", "Liga Foster's Hollywood 1ª División Femenina"),
    calendar("FEB", "LLVAL TERCERA FEB"),
    calendar("Femenina", "LLVAL FEMENINA"),
    calendar("Otro", "Otra categoría"),
  ];
  assert.deepEqual(upcomingMatches(data, now).map(({ team }) => team.name), [
    "División", "FEB", "Femenina", "Senior A", "Senior B", "Junior", "Cadete", "Infantil", "Alevín", "Benjamín", "Otro",
  ]);
});

test("selects one next unplayed match across competitions by actual instant, not round or offset", () => {
  const data = calendar("Equipo", "Junior", [
    match("past", "2026-10-07T20:00:00+02:00"),
    match("played", "2026-10-09T18:00:00+02:00", { home_score: 0, away_score: 42 }),
    match("undated", null),
    match("later", "2026-10-25T02:15:00+01:00"),
  ]);
  data.groups.push({ category: "JÚNIOR FEMENINO", rounds: [{ matches: [
    match("next", "2026-10-25T02:30:00+02:00"),
  ] }] });
  const result = upcomingMatches([data], now);
  assert.equal(result.length, 1);
  assert.equal(result[0].match.id, "next");
  assert.equal(result[0].category, "JÚNIOR FEMENINO");
});

test("retains teams without a dated upcoming match instead of hiding them", () => {
  const data = [
    calendar("Sin fecha", "Cadete", [match("pending", null)]),
    calendar("Terminado", "Senior", [match("past", "2026-10-01T10:00:00Z")]),
    calendar("Descanso", "Infantil"),
  ];
  assert.deepEqual(upcomingMatches(data, now).map(({ team, match }) => [team.name, match]), [
    ["Terminado", null], ["Sin fecha", null], ["Descanso", null],
  ]);
  assert.deepEqual(upcomingMatches([], now), []);
});
