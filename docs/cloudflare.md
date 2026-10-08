# PoC en Cloudflare: Workers y D1

PoC publicada: [En pista](https://fbcv-calendar-manager.aitor935.workers.dev).

La web React se sirve con Workers Static Assets. Una API TypeScript en Workers
mantiene las mismas rutas que FastAPI y usa D1, el SQLite gestionado de
Cloudflare. Docker/FastAPI/SQLite local siguen disponibles para un futuro VPS.

El crawler Scrapy puede ejecutarse localmente o en GitHub Actions dos veces al
día. Cloudflare recibe una copia de los datos validados; el crawler no se
ejecuta dentro del Worker. El exportador reutiliza los formatos de la API Python y el detector
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

La actualización automática conserva las dos versiones más recientes por temporada
y cualquier versión activa. Limpia el resto con `cloudflare/cleanup-snapshots.sql`
solo después de una importación correcta; nunca modifica `conflict_reviews`. El SQL generado permanece fuera de
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

## Despliegue automático de la web

El workflow `.github/workflows/deploy-web.yml` publica Worker y frontend en
cada push a `main`. También permite ejecución manual desde Actions, solo en
`main`. Ejecuta pruebas Python y frontend, compila la web, comprueba tipos y
valida el empaquetado con `wrangler deploy --dry-run` antes de publicar.
Después comprueba que la web y `/api/meta` responden correctamente. El SHA
del commit queda en el mensaje de la versión de Cloudflare y en el resumen
de Actions. Los despliegues no se ejecutan simultáneamente ni se cancelan
durante una publicación por un push posterior.

### Configuración manual necesaria

1. Actualizar el token de API existente en Cloudflare con rol **Workers → Editor**, limitado
   al Worker existente `fbcv-calendar-manager` de la cuenta configurada en
   `cloudflare/wrangler.jsonc`. Si el panel todavía muestra permisos antiguos,
   el equivalente es **Account → Workers Scripts → Edit**, limitado a esa
   cuenta. Conservar **Account → D1 → Edit**, necesario para el crawler.
   El despliegue de código no necesita permisos de zonas ni modifica D1.
2. Ambos workflows usan el secret de repositorio **`CLOUDFLARE_API_TOKEN`**
   en [GitHub → Settings → Secrets and variables → Actions](https://github.com/AitorCM/fbcv-calendar-manager/settings/secrets/actions).
   Si solo cambian permisos del mismo token, no hace falta actualizar el valor
   del secret. Si se crea otro token, reemplazarlo en GitHub. No pegar su valor
   en el chat, código ni logs. No hace falta crear otro secret.
3. Una vez subido el workflow a `main`, abrir
   [Actions → Desplegar web en Cloudflare](https://github.com/AitorCM/fbcv-calendar-manager/actions/workflows/deploy-web.yml)
   y usar **Run workflow** sobre `main`, o hacer un nuevo push. Si el workflow
   falló antes de crear el secret, volver a ejecutar el job fallido.

No hace falta crear otro Worker, base D1 ni conectar Workers Builds. Si ya
existe un despliegue automático configurado en Cloudflare, desactivarlo para
evitar dos pipelines publicando sobre el mismo Worker. Este workflow no ejecuta
el crawler, importaciones SQL ni migraciones; los datos siguen actualizándose
con `refresh-calendars.yml`.

Permisos: [Workers y Wrangler](https://developers.cloudflare.com/workers/authorization/workers/#wrangler).

### Rollback de código

En Cloudflare, abrir **Workers & Pages → fbcv-calendar-manager → Deployments**,
seleccionar una versión estable anterior y usar **Rollback**. Comprobar la web
y `/api/meta` después. Esto revierte código y assets de esa versión, no datos
de D1 ni revisiones. Corregir o revertir también el cambio en Git antes del
siguiente push a `main`, porque el pipeline volverá a publicar el código del
repositorio. No hay rollback automático si falla la comprobación posterior
al despliegue.

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


## Actualización automática en GitHub Actions

El workflow `.github/workflows/refresh-calendars.yml` está programado a las
**00:00 y 12:00 Europe/Madrid**, con ajuste automático de horario de verano.
GitHub puede retrasar el inicio; son las horas previstas de comienzo, no de
finalización. [Documentación del horario](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#onschedule).

Antes de activar la publicación, crear un token personalizado en la cuenta de
Cloudflare usada por la PoC, con permiso **Account → D1 → Edit**, limitado a esa
cuenta. No hace falta permiso para desplegar Workers: solo cambia la base D1.
Guardar el valor en el secret de repositorio `CLOUDFLARE_API_TOKEN` en
[GitHub → Settings → Secrets and variables → Actions](https://github.com/AitorCM/fbcv-calendar-manager/settings/secrets/actions).
No copiarlo al código, al chat ni usar el OAuth local de Wrangler.
[Creación de tokens](https://developers.cloudflare.com/fundamentals/api/get-started/create-token/).

El job falla al principio si falta el secret. Descarga desde cero toda la
temporada 2026–2027, sin `--resume`, para detectar modificaciones. Exige estado
`complete` y cobertura total antes de exportar/publicar. Si falla el crawler,
los calendarios publicados no cambian. Las revisiones de D1 se conservan.
La limpieza posterior limita almacenamiento; con los datos actuales, importación
y limpieza dos veces al día suman aproximadamente 56.000 escrituras diarias,
además de las revisiones de visitantes y del consumo de otras bases de la cuenta.

Desde la pestaña [Actions](https://github.com/AitorCM/fbcv-calendar-manager/actions/workflows/refresh-calendars.yml)
puede ejecutarse manualmente. `dry_run=true` permite probar descarga y exportación
sin credenciales ni cambios en D1. Los informes quedan como artifacts durante
14 días. El job tiene un límite de 90 minutos y no permite ejecuciones simultáneas.
No se sube SQLite al repositorio ni se vuelve a desplegar el frontend.

En repositorios públicos, GitHub puede desactivar las tareas programadas tras
60 días sin actividad: revisar su estado en Actions si deja de actualizarse.
[Limitaciones del scheduler](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule).
