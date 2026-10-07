"""FBCV adapter using only routes exposed by its public competition UI."""

import base64
import json
import re
from urllib.parse import urlsplit

import scrapy

from .store import now

ENTRY = "https://www.fbcv.es/competiciones/calendario-resultados-y-clasificacion/"

# Adapted design from sci-crawl: TLS verification, robots, AutoThrottle,
# bounded retries and explicit scopes. No dependency on its Markdown pipeline.
SETTINGS = {
    "USER_AGENT": "FBCVCalendarManager/0.1 (calendar research crawler)",
    "ROBOTSTXT_OBEY": True,
    "DOWNLOAD_VERIFY_CERTIFICATES": True,
    "DOWNLOADER_CLIENTCONTEXTFACTORY": "scrapy.core.downloader.contextfactory.BrowserLikeContextFactory",
    "CONCURRENT_REQUESTS": 2,
    "CONCURRENT_REQUESTS_PER_DOMAIN": 2,
    "DOWNLOAD_DELAY": 0.5,
    "AUTOTHROTTLE_ENABLED": True,
    "AUTOTHROTTLE_START_DELAY": 0.5,
    "AUTOTHROTTLE_MAX_DELAY": 20,
    "AUTOTHROTTLE_TARGET_CONCURRENCY": 1,
    "RETRY_TIMES": 3,
    "DOWNLOAD_TIMEOUT": 40,
    "COOKIES_ENABLED": False,
    "TELNETCONSOLE_ENABLED": False,
    # Source uses a URL-embedded public frontend key: never log request URLs.
    "LOG_ENABLED": False,
    "DOWNLOADER_MIDDLEWARES": {"fbcv_calendar.crawler.ScopeMiddleware": 50},
    "TWISTED_REACTOR": "twisted.internet.asyncioreactor.AsyncioSelectorReactor",
}


class ScopeMiddleware:
    def process_request(self, request, spider):
        from scrapy.exceptions import IgnoreRequest

        url = urlsplit(request.url)
        if (
            url.scheme != "https"
            or url.hostname not in {"www.fbcv.es", "esb.optimalwayconsulting.com"}
            or url.port not in (None, 443)
        ):
            raise IgnoreRequest("Request outside reviewed source hosts")
        if url.path == "/robots.txt" or request.url == ENTRY:
            return None
        if not spider.api or not request.url.startswith(spider.api + "/"):
            raise IgnoreRequest("Request outside public calendar API")


def decode_response(body):
    raw = body.strip()
    if raw.startswith(b'"'):
        raw = json.loads(raw)
    is_json = raw.startswith(b"{") if isinstance(raw, bytes) else raw.startswith("{")
    if not is_json:
        raw = base64.b64decode(raw, validate=True)
    data = json.loads(raw)
    if data.get("result") != "OK":
        raise ValueError("Source returned a non-OK result")
    return data["messageData"]


def confirmed_empty_schedule(data):
    # The regular results route confirms unpublished calendars when the
    # match-record route fails. Never turn an incomplete nonempty response empty.
    if data.get("totalRounds") != 0 or data.get("rounds") or data.get("playoffs"):
        raise ValueError("La ruta alternativa no confirma un calendario vacío")
    return {**data, "rounds": {}, "rest": {}}


class CalendarSpider(scrapy.Spider):
    name = "fbcv_calendar"
    allowed_domains = ["www.fbcv.es", "esb.optimalwayconsulting.com"]

    def __init__(
        self, store, season, run_id, selected_groups=None, resume=None, *args, **kwargs
    ):
        super().__init__(*args, **kwargs)
        self.store, self.season, self.run_id = store, season, run_id
        self.selected_groups = set(selected_groups or [])
        self.resume = resume
        self.api = None
        self.errors = []
        self.groups = set()
        self.done = set()
        self.skipped = set()
        self.started_groups = set()
        self.families = 0

    @classmethod
    def from_crawler(cls, crawler, *args, **kwargs):
        from scrapy import signals

        spider = super().from_crawler(crawler, *args, **kwargs)
        crawler.signals.connect(spider.parser_error, signal=signals.spider_error)
        return spider

    def parser_error(self, failure, response, spider):
        message = re.sub(r"https?://\S+", "[source URL]", failure.getErrorMessage())
        error = {
            "stage": response.meta.get("stage"),
            "type": failure.type.__name__,
            "message": message,
        }
        group = response.meta.get("group_id")
        if group:
            error["group_id"] = group
            self.store.fail_group(self.run_id, group, json.dumps(error))
        self.errors.append(error)
        self.event(event="parser_error", **error)

    async def start(self):
        yield scrapy.Request(
            ENTRY,
            callback=self.bootstrap,
            errback=self.failure,
            meta={"stage": "bootstrap"},
        )

    def event(self, **values):
        print(json.dumps({"time": now(), **values}, ensure_ascii=False), flush=True)

    def request(self, path, callback, **context):
        return scrapy.Request(
            self.api + path,
            callback=callback,
            errback=self.failure,
            cb_kwargs=context,
            meta={"stage": callback.__name__, **context},
        )

    def failure(self, failure):
        context = failure.request.meta
        # Exception messages may contain URLs/keys. Persist only safe classification.
        error = {"stage": context.get("stage"), "type": failure.type.__name__}
        if getattr(failure.value, "response", None) is not None:
            error["http_status"] = failure.value.response.status
        for key in ("type_id", "competition_id", "category_id", "group_id"):
            if key in context:
                error[key] = context[key]
        if (
            context.get("group_id")
            and context.get("stage") == "schedule"
            and error.get("http_status", 0) >= 500
        ):
            self.event(
                event="checking_empty_calendar",
                group=context["group_id"],
                http_status=error["http_status"],
            )
            return [
                self.request(
                    "/FCBQWeb/resultats/" + context["group_id"],
                    self.empty_schedule,
                    group_id=context["group_id"],
                )
            ]
        self.errors.append(error)
        if context.get("group_id"):
            self.store.fail_group(self.run_id, context["group_id"], json.dumps(error))
        self.event(event="error", **error)

    def read(self, response, expected):
        try:
            value = decode_response(response.body)
            if not isinstance(value, expected):
                raise ValueError("Unexpected response shape")
            return value
        except (ValueError, KeyError, TypeError) as error:
            self.errors.append(
                {"stage": response.meta.get("stage"), "type": type(error).__name__}
            )
            group = response.meta.get("group_id")
            if group:
                self.store.fail_group(self.run_id, group, "Invalid response envelope")
            self.event(event="invalid_response", stage=response.meta.get("stage"))
            return None

    def bootstrap(self, response):
        try:
            config = json.loads(
                re.search(r"var owbasket\s*=\s*(\{.*?\});", response.text).group(1)
            )
            api = config["owbasket-apis"][0]["esb"]["url"].rstrip("/")
            parts = urlsplit(api)
            if (
                parts.scheme != "https"
                or parts.hostname != "esb.optimalwayconsulting.com"
                or not parts.path.startswith("/fbcv/1/")
                or parts.query
                or parts.fragment
                or parts.username
                or parts.port not in (None, 443)
            ):
                raise ValueError("Source configuration outside reviewed scope")
            self.api = api
        except (ValueError, AttributeError, KeyError, IndexError):
            self.errors.append({"stage": "bootstrap", "type": "InvalidConfig"})
            return
        yield self.request("/Season/getActiveWebVisibility", self.seasons)

    def seasons(self, response):
        values = self.read(response, list)
        if values is None:
            return
        season = next((s for s in values if str(s["idSeason"]) == self.season), None)
        if not season:
            self.errors.append({"stage": "season", "type": "SeasonUnavailable"})
            return
        with self.store.db:
            self.store.entity(
                self.season, "season", self.season, season["name"], season, self.run_id
            )
        yield self.request(
            "/CompetitionsSelector/getAllWithComptitionAndVisibleTypeOne", self.types
        )

    def types(self, response):
        values = self.read(response, list)
        if values is None:
            return
        self.families = len(values)
        for value in values:
            id_ = str(value["id"])
            with self.store.db:
                self.store.entity(
                    self.season,
                    "type",
                    id_,
                    value["agrupationName"],
                    value,
                    self.run_id,
                    "season",
                    self.season,
                )
            yield self.request(
                "/CompetitionsSelector/getByLvLOneIdAndTypeTwo/" + id_,
                self.competitions,
                type_id=id_,
            )

    def competitions(self, response, type_id):
        values = self.read(response, list)
        if values is None:
            return
        for value in values:
            id_ = str(value["id"])
            with self.store.db:
                self.store.entity(
                    self.season,
                    "competition_selector",
                    id_,
                    value["agrupationName"],
                    value,
                    self.run_id,
                    "type",
                    type_id,
                )
            yield self.request(
                f"/CategoryRegistered/getByLvLOneIdAndLvLTwoIdAndSeasonId/{type_id}/{id_}/{self.season}",
                self.categories,
                type_id=type_id,
                competition_id=id_,
            )

    def categories(self, response, type_id, competition_id):
        values = self.read(response, list)
        if values is None:
            return
        for value in values:
            id_ = str(value["idCategoryRegistred"])
            with self.store.db:
                self.store.entity(
                    self.season,
                    "category",
                    id_,
                    value["categoryRegisteredName"],
                    value,
                    self.run_id,
                    "competition_selector",
                    competition_id,
                )
            yield self.request(
                f"/Competition/getCompetitionGroupVisibleWeb/{id_}/",
                self.group_list,
                category_id=id_,
            )

    def group_list(self, response, category_id):
        values = self.read(response, list)
        if values is None:
            return
        for value in values:
            if str(value["season"]) != self.season:
                continue
            id_ = str(value["idGroup"])
            if id_ in self.groups:
                continue
            self.groups.add(id_)
            self.store.group(self.season, value)
            with self.store.db:
                self.store.entity(
                    self.season,
                    "group",
                    id_,
                    value["nameGrupCompetition"],
                    value,
                    self.run_id,
                    "category",
                    category_id,
                )
            if self.selected_groups and id_ not in self.selected_groups:
                continue
            if self.resume:
                previous = self.store.db.execute(
                    "SELECT status FROM group_runs WHERE run_id=? AND group_id=?",
                    (self.resume, id_),
                ).fetchone()
                current = self.store.db.execute(
                    "SELECT last_success_run FROM groups WHERE season=? AND id=?",
                    (self.season, id_),
                ).fetchone()
                if (
                    previous
                    and previous[0] in ("complete", "empty")
                    and current[0] is not None
                    and current[0] <= self.resume
                ):
                    self.skipped.add(id_)
                    with self.store.db:
                        self.store.db.execute(
                            "INSERT OR REPLACE INTO group_runs SELECT ?,group_id,status,rounds,matches,error FROM group_runs WHERE run_id=? AND group_id=?",
                            (self.run_id, self.resume, id_),
                        )
                    continue
            self.started_groups.add(id_)
            yield self.request(
                "/FCBQWeb/getAllGamesByGrupWithMatchRecords/" + id_,
                self.schedule,
                group_id=id_,
            )

    def schedule(self, response, group_id):
        data = self.read(response, dict)
        if data is None:
            return
        try:
            count = self.store.save_schedule(self.run_id, self.season, group_id, data)
        except (ValueError, KeyError, TypeError, OverflowError) as error:
            self.store.fail_group(self.run_id, group_id, str(error))
            self.errors.append(
                {
                    "stage": "schedule",
                    "group_id": group_id,
                    "type": type(error).__name__,
                }
            )
            self.event(event="invalid_schedule", group=group_id, error=str(error))
            return
        self.done.add(group_id)
        self.event(
            event="group_saved",
            group=group_id,
            matches=count,
            completed=len(self.done),
            discovered=len(self.groups),
        )

    def empty_schedule(self, response, group_id):
        data = self.read(response, dict)
        if data is None:
            return
        try:
            confirmed = confirmed_empty_schedule(data)
            self.store.save_schedule(self.run_id, self.season, group_id, confirmed)
        except (ValueError, KeyError, TypeError) as error:
            self.store.fail_group(self.run_id, group_id, str(error))
            self.errors.append(
                {
                    "stage": "empty_schedule",
                    "group_id": group_id,
                    "type": type(error).__name__,
                }
            )
            self.event(event="invalid_empty_confirmation", group=group_id)
            return
        self.done.add(group_id)
        self.event(
            event="empty_calendar_confirmed",
            group=group_id,
            completed=len(self.done),
            discovered=len(self.groups),
        )

    def closed(self, reason):
        stats = self.crawler.stats.get_stats()
        exceptions = sum(
            v
            for k, v in stats.items()
            if k.startswith("spider_exceptions/")
            and k != "spider_exceptions/count"
            and isinstance(v, int)
        )
        targeted = (
            self.groups & self.selected_groups if self.selected_groups else self.groups
        )
        missing_selected = self.selected_groups - self.groups
        pending = targeted - self.done - self.skipped
        successful = (
            reason == "finished"
            and self.families > 0
            and not self.errors
            and not exceptions
            and not pending
            and not missing_selected
            and bool(targeted)
        )
        rows = self.store.db.execute(
            "SELECT status,COUNT(*),COALESCE(SUM(matches),0),COALESCE(SUM(rounds),0) FROM group_runs WHERE run_id=? GROUP BY status",
            (self.run_id,),
        ).fetchall()
        report = {
            "run_id": self.run_id,
            "season": self.season,
            "status": ("sample" if self.selected_groups else "complete")
            if successful
            else "partial",
            "finish_reason": reason,
            "families": self.families,
            "discovered_groups": len(self.groups),
            "targeted_groups": len(targeted),
            "downloaded_groups": len(self.done),
            "reused_groups": len(self.skipped),
            "missing_selected": sorted(missing_selected),
            "pending_groups": sorted(pending),
            "errors": self.errors,
            "spider_exceptions": exceptions,
            "coverage": {
                s: {"groups": n, "matches": m, "rounds": r} for s, n, m, r in rows
            },
            "requests": stats.get("downloader/request_count", 0),
            "finished_at": now(),
        }
        self.store.finish(self.run_id, report)
        self.event(event="finished", **report)
