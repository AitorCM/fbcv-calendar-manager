FROM python:3.12-slim
WORKDIR /app
COPY pyproject.toml uv.lock ./
COPY src ./src
RUN pip install --no-cache-dir uv && uv sync --locked --no-dev
RUN mkdir /data
ENV PYTHONUNBUFFERED=1
ENV PATH="/app/.venv/bin:$PATH"
ENTRYPOINT ["fbcv-crawl", "--db", "/data/fbcv.sqlite3"]
CMD ["crawl", "--season", "2026"]
