import argparse
import csv
import fcntl
import json
import sqlite3
from pathlib import Path

from .store import Store


def main():
    parser = argparse.ArgumentParser(description="Calendarios publicados FBCV → SQLite")
    parser.add_argument("--db", default="data/fbcv.sqlite3")
    subs = parser.add_subparsers(dest="command", required=True)
    crawl = subs.add_parser("crawl")
    crawl.add_argument("--season", default="2026")
    crawl.add_argument(
        "--group", action="append", help="Muestra: limitar descargas a estos grupos"
    )
    crawl.add_argument(
        "--resume",
        type=int,
        help="Reutilizar grupos válidos de una ejecución interrumpida; no refresca sus horarios",
    )
    for command in ("report", "clubs", "export"):
        p = subs.add_parser(command)
        p.add_argument("--season", default="2026")
        if command == "export":
            p.add_argument("--club")
            p.add_argument("--output", default="data/matches.jsonl")
            p.add_argument("--format", choices=["jsonl", "csv"], default="jsonl")
    backup = subs.add_parser("backup")
    backup.add_argument("output")
    args = parser.parse_args()
    if args.command == "crawl":
        Path(args.db).parent.mkdir(parents=True, exist_ok=True)
        lock = open(args.db + ".crawl.lock", "a")
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            parser.exit(2, "Ya hay un crawler escribiendo esta base de datos.\n")
        store = Store(args.db)
        if args.resume:
            previous = store.db.execute(
                "SELECT season,status FROM runs WHERE id=?", (args.resume,)
            ).fetchone()
            if not previous or previous[0] != args.season:
                parser.exit(
                    2, "La ejecución indicada no existe o pertenece a otra temporada.\n"
                )
        run_id = store.start(args.season)
        from scrapy.crawler import CrawlerProcess
        from .crawler import CalendarSpider, SETTINGS

        process = CrawlerProcess(SETTINGS)
        process.crawl(
            CalendarSpider,
            store=store,
            season=args.season,
            run_id=run_id,
            selected_groups=args.group,
            resume=args.resume,
        )
        try:
            process.start()
        finally:
            current = store.db.execute(
                "SELECT status FROM runs WHERE id=?", (run_id,)
            ).fetchone()[0]
            if current == "running":
                store.finish(
                    run_id,
                    {
                        "status": "partial",
                        "error": "Crawler stopped before final report",
                    },
                )
            reports = Path(args.db).parent / "reports"
            reports.mkdir(exist_ok=True)
            report = store.db.execute(
                "SELECT report FROM runs WHERE id=?", (run_id,)
            ).fetchone()[0]
            (reports / f"run-{run_id}.json").write_text(
                json.dumps(json.loads(report), ensure_ascii=False, indent=2)
            )
        status = store.db.execute(
            "SELECT status FROM runs WHERE id=?", (run_id,)
        ).fetchone()[0]
        store.db.close()
        lock.close()
        raise SystemExit(0 if status in ("complete", "sample") else 1)
    if not Path(args.db).exists():
        parser.exit(2, "Base de datos inexistente: ejecuta primero crawl.\n")
    store = Store(args.db)
    if args.command == "report":
        result = store.db.execute(
            "SELECT id,status,report FROM runs WHERE season=? ORDER BY id DESC LIMIT 1",
            (args.season,),
        ).fetchone()
        if not result:
            report = {"status": "no_runs"}
        elif result[2]:
            report = json.loads(result[2])
        else:
            groups = store.db.execute(
                "SELECT COUNT(*) FROM discovery WHERE run_id=? AND kind='group'",
                (result[0],),
            ).fetchone()[0]
            coverage = store.db.execute(
                "SELECT status,COUNT(*),COALESCE(SUM(matches),0) FROM group_runs WHERE run_id=? GROUP BY status",
                (result[0],),
            ).fetchall()
            report = {
                "run_id": result[0],
                "status": result[1],
                "observed_groups": groups,
                "coverage": {
                    status: {"groups": count, "matches": matches}
                    for status, count, matches in coverage
                },
            }
        print(json.dumps(report, ensure_ascii=False, indent=2))
    elif args.command == "clubs":
        print(
            json.dumps(
                [
                    {"id": id_, "name": name}
                    for id_, name in store.db.execute(
                        "SELECT id,name FROM entities WHERE season=? AND kind='club' ORDER BY name",
                        (args.season,),
                    )
                ],
                ensure_ascii=False,
                indent=2,
            )
        )
    elif args.command == "backup":
        if Path(args.output).resolve() == Path(args.db).resolve():
            parser.exit(2, "El backup debe tener una ruta distinta.\n")
        Path(args.output).parent.mkdir(parents=True, exist_ok=True)
        with sqlite3.connect(args.output) as target:
            store.db.backup(target)
        print(args.output)
    elif args.command == "export":
        if Path(args.output).resolve() == Path(args.db).resolve():
            parser.exit(2, "La exportación no puede sobrescribir la base de datos.\n")
        store.export(args.output, args.season, args.club)
        if args.format == "csv":
            rows = [
                json.loads(line) for line in Path(args.output).read_text().splitlines()
            ]
            with open(args.output, "w", newline="") as out:
                from .store import MATCH_FIELDS

                writer = csv.DictWriter(
                    out, fieldnames=[*MATCH_FIELDS, "round", "starts_at"]
                )
                writer.writeheader()
                writer.writerows(rows)
        print(args.output)
    store.db.close()
