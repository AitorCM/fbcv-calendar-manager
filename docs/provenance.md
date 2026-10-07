# Procedencia y decisiones

Referencia de implementación: repositorio local Sciling `sciling-skills`,
`skills/sci-crawler`, revisión `bffc2613292814864af4e32d8727d2f5af115431`.

Archivos examinados: `pyproject.toml`, `sci_crawler/settings.py`,
`sci_crawler/spiders/sciling_spider.py`,
`sci_crawler/spiders/sites_configs/base.py` y `SKILL.md`.

Se reutiliza el enfoque Scrapy y las opciones de TLS, robots, throttling,
concurrencia, reintentos, control de alcance, captura por ejecución y distinción
entre resultado completo y parcial. El crawler nuevo tiene su propia CLI,
spider y almacenamiento; no copia el motor Markdown/PDF ni instala Selenium.
Las configuraciones por defecto que excluyen calendarios, queries y APIs no
sirven para el alcance solicitado y se sustituyen por un adaptador específico.

Se conserva el repositorio original. No hay imports desde rutas de ese
repositorio, por lo que el Docker funciona de forma independiente. No se ha
copiado código sustancial del motor; no se encontró licencia general del
repositorio y no se presupone permiso de redistribución de ese motor.

Decisiones de esta fase:
- SQLite con sqlite3 estándar, WAL, transacciones y lock de crawler.
- No añadir SQLAlchemy/Alembic mientras sólo existe este esquema inicial.
- Consumir las rutas del frontend mediante Scrapy; no automatizar clicks para
  cada grupo ni convertir datos estructurados a Markdown para analizarlos.
- Una futura API y UI serán fases separadas sobre esta misma base de datos.
