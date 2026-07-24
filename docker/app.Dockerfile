# syntax=docker/dockerfile:1

FROM node:22-alpine AS assets
WORKDIR /app
ENV CI=true
COPY package.json package-lock.json ./
COPY packages ./packages
RUN npm ci
COPY . .
ARG VITE_APP_NAME=FreeDraw
ARG VITE_COLLAB_ENABLED=false
ARG VITE_COLLAB_URL=
RUN npm run build

FROM composer:2 AS vendor
WORKDIR /app
COPY composer.json composer.lock ./
RUN composer install --no-dev --no-scripts --no-autoloader --prefer-dist --no-interaction
COPY . .
RUN composer dump-autoload --optimize --classmap-authoritative --no-dev

FROM php:8.4-fpm-alpine AS app
COPY --from=mlocati/php-extension-installer:latest /usr/bin/install-php-extensions /usr/local/bin/
RUN install-php-extensions pdo_mysql bcmath exif gd intl zip opcache pcntl redis \
    && rm /usr/local/bin/install-php-extensions
WORKDIR /var/www/html
COPY docker/php/php.ini /usr/local/etc/php/conf.d/zz-freedraw.ini
COPY docker/entrypoint.sh /usr/local/bin/entrypoint
RUN chmod +x /usr/local/bin/entrypoint
COPY --chown=www-data:www-data . .
COPY --from=vendor --chown=www-data:www-data /app/vendor ./vendor
COPY --from=assets --chown=www-data:www-data /app/public/build ./public/build
RUN mkdir -p storage/framework/cache storage/framework/sessions storage/framework/views storage/logs bootstrap/cache \
    && chown -R www-data:www-data storage bootstrap/cache
USER www-data
ENTRYPOINT ["entrypoint"]
CMD ["php-fpm"]

FROM nginx:1.27-alpine AS web
COPY docker/nginx/default.conf /etc/nginx/conf.d/default.conf
COPY --from=assets /app/public /var/www/html/public
