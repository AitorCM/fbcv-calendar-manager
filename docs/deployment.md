# Despliegue en Ubuntu

Requisitos del servidor: Git, Docker Engine y Docker Compose v2 instalados,
acceso a GitHub para clonar el repositorio y una carpeta local para SQLite.
Comprobar Docker con `docker compose version`. No hace falta instalar Node o
Python en el servidor; ambos se incluyen en las imágenes.

## Descargar el proyecto

```sh
git clone git@github.com:AitorCM/fbcv-calendar-manager.git
cd fbcv-calendar-manager
mkdir -p data
```

La clonación SSH requiere una clave autorizada en GitHub en el servidor. Si el
repositorio es público, también se puede clonar por HTTPS. El código incluye las
dependencias fijadas y la configuración de las imágenes; `data/` no se sube a Git.

## Obtener los datos

Se puede trasladar la extracción existente o realizar una nueva. Para conservar
la extracción y las revisiones actuales, genera snapshots seguros **en el equipo
local**, incluso si la app está funcionando:

```sh
uv run fbcv-crawl backup data/backups/fbcv.sqlite3
uv run python - <<'PY'
import sqlite3
from pathlib import Path
source = Path('data/reviews.sqlite3').resolve()
if source.is_file():
    destination = Path('data/backups/reviews.sqlite3')
    destination.parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(source.as_uri() + '?mode=ro', uri=True) as src:
        with sqlite3.connect(destination) as dst:
            src.backup(dst)
PY
```

Copia los snapshots al servidor con SCP/SFTP como `data/fbcv.sqlite3` y
`data/reviews.sqlite3`, antes de arrancar la app. Haz que pertenezcan al usuario
que ejecutará el servicio. Si no hay revisiones, su base se crea al consultar
las incompatibilidades. No copies únicamente el archivo de una base activa;
SQLite puede tener cambios todavía en WAL.

Para hacer una **extracción nueva desde el servidor**:

```sh
docker compose run --rm --build --user "$(id -u):$(id -g)" crawler crawl --season 2026
docker compose run --rm --user "$(id -u):$(id -g)" crawler report
```

Este comando descarga la temporada completa. Las revisiones existentes se
conservan; una coincidencia con horario o instalación nuevos requiere revisión.

## Arrancar la web

```sh
LOCAL_UID=$(id -u) LOCAL_GID=$(id -g) docker compose up --build -d web
docker compose ps
docker compose logs --tail 100 web
curl --fail http://127.0.0.1:8080/api/meta
```

UID/GID hacen que la app pueda escribir revisiones en el volumen sin crear
archivos propiedad de root. Usa esos mismos valores para futuros comandos de
Compose. La web se reinicia automáticamente al reiniciar Docker.

Para probarla desde tu equipo mediante un túnel SSH:

```sh
ssh -N -L 8080:127.0.0.1:8080 usuario@servidor
```

Abre `http://127.0.0.1:8080` en tu equipo. Si ese puerto local ya está ocupado,
usa `-L 8081:127.0.0.1:8080` y abre el puerto 8081.

La configuración actual escucha solo en localhost. La PoC comparte las
revisiones entre visitantes y no tiene autenticación por gestor. Para dar acceso
público, preparar un proxy con HTTPS y control de acceso antes de exponerla.

## Actualizar y detener

```sh
git pull --ff-only
LOCAL_UID=$(id -u) LOCAL_GID=$(id -g) docker compose up --build -d web
```

Los cambios de código no reemplazan los datos del volumen. Actualizar la web no
inicia el crawler. Para detenerla, `docker compose down`. Conserva backups de
ambas bases fuera del servidor; el volumen local no es una copia de seguridad.
