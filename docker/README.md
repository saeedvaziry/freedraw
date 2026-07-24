# Self-hosting FreeDraw with Docker Compose

`docker-compose.yml` (at the repo root) runs the full stack: nginx, PHP-FPM, a
Horizon queue worker, the scheduler, the Hocuspocus realtime server, MySQL and
Redis.

## Services

| Service      | Image / build target        | Purpose                                                   |
| ------------ | --------------------------- | --------------------------------------------------------- |
| `web`        | `docker/app.Dockerfile` → `web`  | nginx: serves built assets, FastCGI to `app`, `/collab` WebSocket proxy to `hocuspocus` |
| `app`        | `docker/app.Dockerfile` → `app`  | Laravel PHP-FPM. Entrypoint migrates on boot (`CONTAINER_ROLE=app`) |
| `queue`      | same image as `app`         | `php artisan horizon`                                      |
| `scheduler`  | same image as `app`         | `php artisan schedule:work`                               |
| `hocuspocus` | `services/hocuspocus/Dockerfile` | yjs realtime server, persists to MySQL                    |
| `mysql`      | `mysql:8.0`                 | database (`mysql-data` volume)                            |
| `redis`      | `redis:7-alpine`            | cache + queue backend (`redis-data` volume)              |

Uploaded page assets persist in the `storage-data` volume.

## Setup

```sh
cp .env.example .env
# Generate an app key (writes into .env):
php artisan key:generate           # or: openssl rand -base64 32  -> APP_KEY=base64:...
# Set at least DB_PASSWORD (any non-empty value) in .env.

docker compose build
docker compose up -d
```

The app is served on `http://localhost` (override with `HTTP_PORT`).

## Environment

Compose reads the root `.env` for `${...}` interpolation and passes it to the PHP
containers. `DB_HOST`/`REDIS_HOST` are overridden to the compose service names, and
the DB credentials are pinned from the resolved compose values so they always match
the `mysql` container.

Values worth reviewing in `.env`:

| Variable                              | Notes                                                                 |
| ------------------------------------- | --------------------------------------------------------------------- |
| `APP_KEY`                             | required — `php artisan key:generate`                                  |
| `DB_PASSWORD` / `DB_ROOT_PASSWORD`    | set a real password; MySQL is initialized from these on first boot    |
| `HTTP_PORT`                           | host port for nginx (default `80`)                                    |
| `COLLAB_ENABLED`                      | turn on realtime; gates the token endpoints and Hocuspocus auth        |
| `COLLAB_SECRET`                       | shared HMAC secret — the same value reaches `app` and `hocuspocus`     |
| `VITE_COLLAB_ENABLED` / `VITE_COLLAB_URL` | **build-time** (Vite inlines them). Point the URL at `wss://<host>/collab` and rebuild `web`/`app` after changing |
| `ASSETS_DISK_DRIVER`                  | `local` (default, stored in the `storage-data` volume) or `s3`        |
| `HOCUSPOCUS_PORT`                     | internal Hocuspocus port (default `1234`; nginx proxies `/collab` to it — change `docker/nginx/default.conf` too if you change it) |

## Notes

- `VITE_*` are compiled into the JS bundle, so changing `VITE_COLLAB_URL` requires
  `docker compose build web app` (not just a restart).
- Behind an external TLS terminator, forward `/collab` with the WebSocket `Upgrade`
  headers preserved; the bundled nginx already does this between `web` and `hocuspocus`.
- Only the `app` container runs migrations (guarded by `CONTAINER_ROLE`); `queue` and
  `scheduler` reuse the same image without racing on the schema.
