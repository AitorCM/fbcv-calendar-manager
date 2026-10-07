# PoC en Cloudflare: Workers y D1

PoC publicada: [En pista](https://fbcv-calendar-manager.aitor935.workers.dev).

La web React se sirve con Workers Static Assets. Una API TypeScript en Workers
mantiene las mismas rutas que FastAPI y usa D1, el SQLite gestionado de
Cloudflare. Docker/FastAPI/SQLite local siguen disponibles para un futuro VPS.

El crawler Scrapy sigue ejecutándose en el equipo local. No hay extracción ni
actualización automática en Cloudflare: se publica una copia de los datos ya
validados. El exportador reutiliza los formatos de la API Python y el detector
de coincidencias, para mantener el mismo resultado en ambas versiones.

## Cuenta y recursos

`cloudflare/wrangler.jsonc` identifica la cuenta y D1 de esta PoC. Los IDs no son
credenciales. Los tokens de Wrangler se guardan fuera del repositorio; no subir
`.dev.vars`, tokens, snapshots SQL ni archivos de SQLite a Git.

Para usar otra cuenta, autentícate y crea una base distinta antes de cambiar
`account_id` y `database_id`. No reutilices los IDs de esta cuenta.

## Preparación

Se recomienda Node 22 y npm; la carpeta Cloudflare también fija un runtime Node
22 como dependencia local para este equipo. Para generar datos se necesita
Python 3.12 y uv. Desde la raíz:

```sh
npm ci --prefix frontend
npm run build --prefix frontend
npm ci --prefix cloudflare
cd cloudflare
npm exec -- wrangler whoami
npm run check
```

Comprobar siempre la cuenta antes de usar `--remote`. Si no hay sesión, utilizar
`npm exec -- wrangler login` y completar la autenticación en el navegador.

## Primera carga y actualizaciones de datos

Desde la raíz, después de completar el crawler:

```sh
uv run python scripts/export_cloudflare.py
cd cloudflare
npm exec -- wrangler d1 migrations apply DB --remote
npm exec -- wrangler d1 execute DB --remote --file ../data/cloudflare-snapshot.sql --yes
```

El exportador toma un backup consistente de SQLite, no modifica la base original
y genera `data/cloudflare-snapshot.sql`. La importación añade una versión nueva;
el puntero de versión activa se publica al final. No se borran ni sobrescriben
las revisiones de Cloudflare. Una importación fallida deja visible la versión
anterior; regenerar el SQL antes de reintentar para usar un ID de versión nuevo.

Los calendarios usan un modelo de lectura precalculado por equipo y club. Las
revisiones siguen en una tabla separada y los identificadores de incidencias se
mantienen entre versiones si sus horarios, equipos e instalación no cambian.
Las revisiones locales de `data/reviews.sqlite3` y las de D1 son independientes;
esta primera publicación parte sin revisiones locales (la base estaba vacía).

Se conservan versiones antiguas para recuperación. Al refrescar repetidamente,
controlar el almacenamiento y limpiar versiones inactivas mediante una tarea
específica; nunca borrar `conflict_reviews`. El SQL generado permanece fuera de
Git. La carga inicial usa aproximadamente 15 MB y 14.062 escrituras de D1,
contando los índices, con 228 clubes, 1.940 equipos y 2.693 incidencias por club.
Una pareja que afecta a dos clubes aparece una vez en cada club.

## Publicar código

Desde `cloudflare/`:

```sh
npm run deploy
```

Este comando compila el frontend, genera y comprueba tipos y publica Worker y
assets. No importa datos ni ejecuta el crawler. Para validar el empaquetado sin
publicar, ejecutar `npm run build`, `npm run check` y `npm run dry-run`.

La URL `workers.dev` aparece al terminar el despliegue. La configuración no
crea dominios personalizados ni cambia otras aplicaciones de la cuenta.

## Probar Cloudflare en local

```sh
cd cloudflare
npm exec -- wrangler d1 migrations apply DB --local
npm exec -- wrangler d1 execute DB --local --file ../data/cloudflare-snapshot.sql --yes
npm run dev
```

Abrir `http://localhost:8787`. D1 local está en `cloudflare/.wrangler/` y queda
fuera de Git. `--local` no modifica D1 remoto.

La comprobación de la PoC compara clubes, equipos y calendario con la API Python
y comprueba guardado/reapertura de revisiones, pertenencia al club y validación
de entradas sobre D1 local. También se revisa la UI publicada.

## Alcance y costes

La URL es pública y la PoC sigue compartiendo revisiones entre visitantes; no
incluye autenticación por gestor. El control de origen de escritura impide
solicitudes desde páginas de otros sitios, pero no sustituye la autenticación.

Workers y D1 tienen planes gratuitos con cuotas. Esta carga inicial cabe en
ellas; comprobar consumo en el panel. Superar cuotas del plan gratuito puede
hacer fallar solicitudes. No se ha contratado un plan de pago ni un VPS.

Fuentes: [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/),
[D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/),
[D1 limits](https://developers.cloudflare.com/d1/platform/limits/) y
[Workers Static Assets](https://developers.cloudflare.com/workers/static-assets/).

Para respaldar todas las revisiones y versiones en D1, desde `cloudflare/`:

```sh
npm exec -- wrangler d1 export DB --remote --output ../data/backups/cloudflare-d1.sql
```

Crear `data/backups` previamente. Para recuperar datos, preparar y validar una
restauración en una base nueva antes de cambiar el binding de producción.
