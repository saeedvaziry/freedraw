# Deployment — Cloudflare Pages

FreeDraw is a static SPA. It deploys to Cloudflare Pages as a Git-connected project.

## Project settings

| Setting                  | Value                  |
| ------------------------ | ---------------------- |
| Production branch        | `main`                 |
| Build command            | `npm run build`        |
| Build output directory   | `apps/web/dist`        |
| Root directory           | `/` (repo root)        |
| Node version             | `20` (from `.nvmrc`)   |

`wrangler.toml` at the repo root declares `pages_build_output_dir`, so the
output directory is also picked up by the Wrangler CLI and CI.

> The build runs `npm install` automatically. To match the project policy of
> installing without lifecycle scripts, set the environment variable
> `NPM_FLAGS = --ignore-scripts` in the Pages project settings.

## SPA routing & headers

`apps/web/public/_redirects` rewrites all paths to `index.html` (200) so the
client-side `createBrowserRouter` handles deep links without 404s.

`apps/web/public/_headers` sets baseline security headers and long-lived,
immutable caching for hashed assets under `/assets`.

Both files are copied verbatim into `apps/web/dist` by Vite at build time.

## Custom domain

Add `freedraw.dev` as a custom domain in the Pages project. Cloudflare issues
the certificate and provisions the DNS records automatically when the domain's
nameservers are on Cloudflare.

## Local production preview

```bash
npm run build
npm run preview --workspace @freedraw/web
```
