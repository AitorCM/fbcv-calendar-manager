"""Crawler failures remain actionable without exposing source credentials."""

import contextlib
import io
import json
import unittest

import scrapy
from scrapy.exceptions import IgnoreRequest
from twisted.python.failure import Failure

from fbcv_calendar.crawler import CalendarSpider, ScopeMiddleware


class CrawlerFailureContracts(unittest.TestCase):
    def test_request_rejections_report_safe_reason_and_redirect_context(self):
        for redirected in (False, True):
            for message in (
                "Request outside reviewed source hosts",
                "Request outside public calendar API",
                "Forbidden by robots.txt",
                "Rejected https://source.example/private-key",
            ):
                with self.subTest(message=message, redirected=redirected):
                    spider = CalendarSpider(store=None, season="2026", run_id=1)
                    request = scrapy.Request(
                        "https://source.example/private-key",
                        meta={"stage": "bootstrap"},
                    )
                    if redirected:
                        request.meta["redirect_urls"] = [
                            "https://source.example/private-key"
                        ]
                    if message.startswith("Request outside"):
                        if message == "Request outside public calendar API":
                            request = request.replace(
                                url="https://www.fbcv.es/unreviewed"
                            )
                        try:
                            ScopeMiddleware().process_request(request, spider)
                        except IgnoreRequest:
                            failure = Failure()
                    else:
                        failure = Failure(IgnoreRequest(message))
                    failure.request = request
                    output = io.StringIO()
                    with contextlib.redirect_stdout(output):
                        spider.failure(failure)
                    event = json.loads(output.getvalue())
                    expected = (
                        "Request rejected" if "private-key" in message else message
                    )
                    self.assertEqual(event["reason"], expected)
                    self.assertEqual(spider.errors[0]["reason"], expected)
                    self.assertEqual(event["redirected"], redirected)
                    self.assertEqual(event["stage"], "bootstrap")
                    self.assertEqual(event["type"], "IgnoreRequest")
                    self.assertNotIn("private-key", json.dumps(spider.errors))
                    self.assertNotIn("private-key", output.getvalue())
