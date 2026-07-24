#!/bin/sh
set -e

role="${CONTAINER_ROLE:-app}"
db_host="${DB_HOST:-mysql}"
db_port="${DB_PORT:-3306}"

echo "[entrypoint] role=${role} waiting for database ${db_host}:${db_port}"
until php -r "exit(@fsockopen(getenv('DB_HOST') ?: 'mysql', (int) (getenv('DB_PORT') ?: 3306)) ? 0 : 1);" 2>/dev/null; do
  sleep 2
done

php artisan config:cache

if [ "$role" = "app" ]; then
  php artisan migrate --force
  php artisan storage:link 2>/dev/null || true
fi

exec "$@"
