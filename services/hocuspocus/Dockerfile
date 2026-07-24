# syntax=docker/dockerfile:1

FROM node:22-alpine AS build
WORKDIR /service
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine AS runtime
WORKDIR /service
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build /service/dist ./dist
USER node
EXPOSE 1234
CMD ["node", "dist/server.js"]
