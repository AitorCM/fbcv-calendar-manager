# FBCV Calendar Manager

PoC de extracción de los calendarios **publicados** de la temporada 2026–2027,
con crawler Python/Scrapy, SQLite y ejecución en Docker. Incluye API FastAPI y
frontend React para consultar clubes, equipos y jornadas, detectar posibles
incompatibilidades y guardar revisiones. Incluye temas claro y oscuro.

PoC publicada: [En pista](https://fbcv-calendar-manager.aitor935.workers.dev).

Para probar sin VPS: [guía de Cloudflare](docs/cloudflare.md).
Para desplegar en un servidor: [guía de Ubuntu](docs/deployment.md).

## Ejecución local

Requisitos: Python 3.12 y uv. Todos los comandos se ejecutan desde esta carpeta.

```sh
uv sync --locked
uv run fbcv-crawl crawl --season 2026
uv run fbcv-crawl report
uv run fbcv-crawl clubs
uv run fbcv-crawl export --output data/matches.jsonl
uv run fbcv-crawl export --club 1715 --format csv --output data/club-1715.csv
uv run fbcv-crawl backup data/backups/fbcv.sqlite3
```

El ID `2026` corresponde a la temporada 2026–2027, no al año natural.
Para una muestra: `uv run fbcv-crawl --db data/smoke.sqlite3 crawl --group 2601`.
La muestra descubre el inventario completo pero descarga partidos sólo de los grupos indicados.
`--group` puede repetirse. Su resultado es `sample`, nunca `complete`.

## Docker en Ubuntu

```sh
docker compose build
docker compose run --rm crawler
docker compose run --rm crawler report
docker compose run --rm crawler export --output /data/matches.jsonl
docker compose run --rm crawler backup /data/backups/fbcv.sqlite3
```

SQLite reside en `./data/fbcv.sqlite3`, persistente mediante bind mount. El crawler
no expone puertos; la web publica el puerto 8080 en localhost. No usar una carpeta de red/NFS para SQLite WAL. El contenedor utiliza
las dependencias fijadas en `uv.lock`. Para evitar archivos propiedad de root,
se puede añadir `--user "$(id -u):$(id -g)"` a `docker compose run`.

El lock de fichero impide que dos crawlers escriban simultáneamente en la misma
base. WAL permite lectores mientras el crawler guarda grupos con transacciones
cortas. La API comparte esta misma carpeta local, no sólo el fichero
principal: SQLite utiliza también ficheros WAL y SHM.

No copiar únicamente el fichero `.sqlite3` durante una ejecución; usar `backup`.

## Extracción y cobertura

El adaptador lee la configuración del frontend oficial en:
https://www.fbcv.es/competiciones/calendario-resultados-y-clasificacion/

Recorre temporada → tipo → competición → categoría → fase/grupo y solicita los
calendarios al servicio que usa esa interfaz. No adivina IDs ni accede a áreas
privadas. El servicio no tiene un contrato público documentado verificado;
cambios en él pueden necesitar cambios en el adaptador.

Respeta robots.txt, verifica TLS, identifica el crawler, limita concurrencia a 2
y utiliza AutoThrottle, retraso inicial de 0,5 segundos y 3 reintentos HTTP.
La clave que publica el frontend en su URL se obtiene en memoria y no se incluye
en logs ni datos guardados. Los hosts de origen están limitados explícitamente.

Cada ejecución registra:

- Inventario y relaciones en `entities`, `discovery` y `groups`.
- Programación en `matches`, `rounds` y `rests`.
- Cambios de datos de partidos en `match_changes`.
- Cobertura y errores por grupo en `group_runs`.
- Informe final en `runs` y `data/reports/run-ID.json`.

La salida es JSON por línea para poder guardar y seguir el progreso:

```sh
uv run fbcv-crawl crawl > data/crawl.log 2>&1
```

Exit 0 significa `complete` (todos los grupos descubiertos) o `sample` (muestra
solicitada). Exit 1 significa cobertura parcial. `complete` exige terminar sin
errores de descubrimiento/parser/descarga, procesar los grupos seleccionados y
hacer coincidir las jornadas recibidas con `totalRounds`. Un grupo sin partidos
queda como `empty`; no se inventan encuentros. Si el endpoint con actas falla con HTTP 5xx tras los reintentos, se consulta
la ruta de resultados que usa el mismo frontend. Sólo se acepta como vacío
cuando declara explícitamente cero jornadas y no contiene jornadas ni
eliminatorias. Un error HTTP por sí solo nunca significa calendario vacío.
Los informes no prueban la
existencia de fases futuras que todavía no se hayan publicado.

Una respuesta inválida no reemplaza datos previos. En una respuesta válida, los
partidos que desaparecen quedan `active=0` y las exportaciones no los incluyen.
Los IDs son texto y su identidad incluye temporada. Los nombres se conservan
como los publica la fuente; no se infieren clubes a partir del nombre del equipo.
Los equipos presentes sólo en descansos pueden no tener todavía club identificado.

`matchDay` es la fecha del encuentro; la fecha de jornada se conserva aparte.
Las horas se interpretan en Europe/Madrid con su offset de verano/invierno.
Una fecha sin hora mantiene `starts_at=null`; una hora 00:00 se conserva como
publicada, sin afirmar que sea un horario confirmado. No se infiere duración.
Las eliminatorias pueden tener participantes provisionales (por ejemplo,
«ganador de la eliminatoria») sin IDs de equipo/club; se conservan así y se
resolverán cuando la fuente publique los participantes.
Se guardan sólo campos del calendario; se descartan permisos y datos
administrativos que el servicio entrega junto con el partido.

## Actualizaciones y recuperación

Repetir `crawl` realiza un refresco completo del inventario y calendarios sin
crear duplicados. Se mantienen ejecuciones anteriores y cambios de partidos.
Una fase/grupo ausente del último inventario conserva su último calendario;
consultar `discovery` para distinguirlo de un grupo observado en la última ejecución.

```sh
uv run fbcv-crawl crawl --resume 1
```

`--resume` redescubre el inventario y reutiliza grupos válidos de la ejecución
indicada sólo si siguen siendo su última captura. Se deben usar exclusivamente
para recuperar una ejecución interrumpida, ya que no actualiza los horarios de
los grupos reutilizados. Para datos recientes, ejecutar sin `--resume`.
Una interrupción abrupta puede dejar `runs.status=running`; no equivale a completo.

## Verificación

```sh
uv run python -m unittest discover -s tests -v
```

Pruebas de idempotencia, cambios de horario con cambio de offset, filtro por
club, conservación ante captura incompleta, descansos vacíos, confirmación de
calendarios no publicados y errores lógicos HTTP 200.
`tests/schedule.json` contiene un extracto de datos públicos del grupo 2601.

## Relación con sci-crawl

Ver [docs/provenance.md](docs/provenance.md). El código original no se modifica
ni se requiere en el servidor. El proyecto usa `sqlite3` de la biblioteca
estándar para mantener la PoC pequeña. La versión de esquema se registra y
cualquier evolución deberá incluir una migración explícita.

## App web: primera versión

### Desarrollo local

Requisitos: Python 3.12, uv y Node.js 20.19+ con npm.

```sh
./scripts/dev.sh
```

Abre **http://127.0.0.1:5173**. El script instala dependencias Python, instala
las del frontend si faltan, inicia la API en el puerto 8000 y Vite en el 5173.
Ctrl+C detiene ambos procesos. Los cambios del frontend se muestran al guardar;
para cambios Python, reinicia el comando. No ejecutar dos copias simultáneas.

1. Escribe o despliega el buscador de club. La búsqueda ignora tildes.
2. Selecciona un club para ver sus equipos con calendario disponible.
3. Pulsa un equipo. Sus partidos se muestran por jornadas, incluidos descansos.
4. Si participa en varias competiciones/fases, elige una en el selector.

El buscador admite flechas, Enter y Escape. La interfaz se adapta a móvil,
incluye estados de carga/error y muestra fechas y horas de Europe/Madrid.
Las fechas junto al número de jornada son las fechas generales de la jornada;
la tarjeta de cada partido muestra su programación concreta. Las horas 00:00
se indican como «Hora por confirmar» para no presentarlas como confirmadas.

### App completa con Docker

```sh
docker compose up --build -d web
```

Abre **http://127.0.0.1:8080**. Una imagen sirve frontend y API en el mismo
origen, sin necesitar Node en el servidor. El puerto se publica únicamente en
localhost; el despliegue público en Ubuntu puede añadir un proxy con HTTPS.
Para detenerla: `docker compose down` (los datos permanecen en `./data`).
El crawler queda en el perfil `tools` y sigue ejecutándose explícitamente con
`docker compose run --rm crawler`; arrancar la web no inicia otro crawl.

### API y build

- `GET /api/meta`: temporada y última extracción.
- `GET /api/clubs?q=...`: clubes con calendario y número de equipos.
- `GET /api/clubs/{club_id}/teams`: equipos disponibles del club.
- `GET /api/clubs/{club_id}/teams/{team_id}/calendar`: jornadas por competición.
- Todas aceptan `season=2026`; la primera UI utiliza 2026–2027.

La API abre la base de calendarios en modo lectura. Las consultas parametrizadas no alteran los
datos. Una consulta de calendario verifica que el equipo pertenece al club.
La web consulta SQLite, sin lanzar crawls ni peticiones nuevas a FBCV.

```sh
cd frontend
npm ci
npm run build
```

Después del build también se puede servir todo sin Vite:
`uv run uvicorn fbcv_calendar.api:app --host 127.0.0.1 --port 8000`, desde la
raíz del proyecto, y abrir http://127.0.0.1:8000.

`FBCV_DB` permite indicar otra base SQLite; `FBCV_STATIC` permite indicar otro
build del frontend. Las pruebas de API usan bases temporales, nunca modifican
la base descargada.

## Revisión de incompatibilidades

Selecciona el club y abre **Incompatibilidades**. Por defecto aparecen las
pendientes desde hoy. Puedes filtrar por estado, equipo, instalación, tipo y
fechas, o pulsar «Ver toda la temporada». Cada incidencia compara dos partidos;
un grupo de tres partidos coincidentes puede generar tres incidencias.

Se comparan partidos activos de equipos distintos del mismo club, en el mismo
`idField` y día local (Europe/Madrid). Se avisa si comienzan a la misma hora o
con menos de 120 minutos de separación. Exactamente dos horas se permite.
Las horas 00:00 se excluyen como no confirmadas. La comparación utiliza la
programación real del partido, no la fecha nominal de jornada.

«Marcar como resuelta» guarda la revisión y una nota opcional. Las resueltas se
pueden consultar, editar y reabrir. Esta acción no modifica los calendarios de
FBCV. La instalación podría disponer de varias canchas: las coincidencias son
posibles conflictos y requieren la comprobación del gestor.

Las revisiones se almacenan en **`data/reviews.sqlite3`**, separado de la base
del crawler, con esquema propio versión 1 y persistencia en el volumen Docker.
`FBCV_REVIEW_DB` permite cambiar su ubicación. Incluir este archivo en los
backups (usar la API de backup de SQLite si la app está funcionando).

La revisión pertenece al club y a la pareja concreta de horarios, instalación
y equipos. Si cambian esos datos, aparece una nueva incidencia pendiente. Los
cambios de resultado no invalidan la revisión. Una incidencia que deja de
existir desaparece de la lista; su revisión se conserva por si se recupera la
misma programación.

Esta PoC comparte las revisiones entre todos los visitantes; todavía no tiene
cuentas ni permisos por gestor. El puerto Docker sigue limitado a localhost.

- `GET /api/clubs/{club_id}/conflicts?season=2026`: incidencias y revisiones.
- `PUT /api/clubs/{club_id}/conflicts/{id}/review?season=2026`: JSON
  `{"resolved": true, "note": "Se usan dos pistas distintas"}`.

La imagen web ejecuta el servicio como usuario 1000:1000. Si tu usuario de
Ubuntu tiene otro UID/GID, usa:

```sh
LOCAL_UID=$(id -u) LOCAL_GID=$(id -g) docker compose up --build -d web
```

Así el servicio puede escribir en el volumen de datos.

Los calendarios se siguen leyendo sin modificaciones. La escritura de la API
se limita a la base de revisiones.

## Temas claro y oscuro

El botón de la cabecera alterna entre ambos temas (en móvil se muestra solo el
icono). La preferencia se guarda en el navegador y se aplica antes de mostrar
la interfaz al recargar. En la primera visita se utiliza el tema del sistema.
Los calendarios, filtros, formularios e incompatibilidades usan la misma paleta.
