# Deployment — Netlify

FreeDraw is a static SPA. It deploys to Netlify as a Git-connected site.
All settings are checked in via `netlify.toml`, so the Netlify UI needs no
manual build configuration.

## Configuration (`netlify.toml`)

| Setting          | Value             | Source                  |
| ---------------- | ----------------- | ----------------------- |
| Build command    | `npm run build`   | `[build]`               |
| Publish directory | `apps/web/dist`  | `[build]`               |
| Node version     | `20`              | `NODE_VERSION`          |
| Install flags    | `--ignore-scripts`| `NPM_FLAGS`             |

`NPM_FLAGS = --ignore-scripts` honors the project policy of installing without
lifecycle scripts.

## SPA routing & headers

`apps/web/public/_redirects` rewrites all paths to `index.html` (200) so the
client-side `createBrowserRouter` handles deep links without 404s.

`apps/web/public/_headers` sets baseline security headers and long-lived,
immutable caching for hashed assets under `/assets`.

Both are Netlify-native files. Vite copies them from `public/` into
`apps/web/dist/` (the publish directory) at build time, where Netlify reads them.

## Custom domain

Add `freedraw.dev` as a custom domain in **Site settings → Domain management**.
Point the domain's DNS to Netlify (or use Netlify DNS); Netlify provisions the
TLS certificate automatically.

## Local production preview

```bash
npm run build
npm run preview --workspace @freedraw/web
```
