# FreeDraw

## Stack

- Laravel 13 (PHP 8.4), Mysql (sqlite for unit tests), Redis + Horizon
- Inertia.js v3, React 19 (TypeScript), Tailwind CSS v4 and Shadcn
- Lucide icons — no inline SVGs
- Scramble (`dedoc/scramble`) — auto-generated OpenAPI docs
- Pest 4

## Architecture

```
Route → Controller → FormRequest → toDto() → Action(s) → Eloquent
  ↓
Inertia::render('Page', Resource::make($model))  OR  API Resource JSON
  ↓
React Inertia Page → reusable Components
```

### Actions (`app/Actions/`)

- Single-responsibility. Compose actions for complex workflows.
- Accept a DTO, return a Model/DTO/primitive.
- Every action gets a test. Grouped by domain (e.g., `app/Actions/Authentication/`).

### DTOs (`app/DTOs/`)

- Typed value objects. FormRequests convert via `toDto()`.
- Never pass FormRequest objects into actions.
- Grouped by domain (e.g., `app/DTOs/Authentication/`).

### Controllers

Thin — validate, convert to DTO, call action(s), return response. No business logic.

Use Laravel 13 attributes: `#[Middleware('auth')]`, `#[Middleware('verified')]`, `#[Middleware('throttle:60,1')]`, `#[Authorize('viewAny', Post::class)]`.

### Models — Laravel 13 Attributes

Use `search-docs` for attribute documentation when needed.

`#[Fillable]`, `#[Guarded]`, `#[Unguarded]`, `#[Hidden]`, `#[Table]`, `#[Connection]`, `#[ObservedBy]`, `#[UseFactory]`, `#[UsePolicy]`, `#[UseResource]`, `#[UseResourceCollection]`, `#[Boot]`, `#[Initialize]`, `#[Scope]`

### Jobs — Laravel 13 Attributes

`#[Tries]`, `#[Timeout]`, `#[Backoff]`, `#[MaxExceptions]`, `#[Queue]`, `#[Connection]`, `#[UniqueFor]`

Route known/static jobs via `Queue::route()` in a dedicated ServiceProvider:

```php
Queue::route(ProcessPodcast::class, connection: 'redis', queue: 'podcasts');
```

### Console Commands — Laravel 13 Attributes

`#[Signature]`, `#[Description]`, `#[Help]`, `#[Hidden]`, `#[Usage]`

### FormRequests & Resources

- Use `--json-api` flag: `php artisan make:resource PostResource --json-api`
- Generate resources from models via `$post->toResource()` with `#[UseResource(PostResource::class)]`

### API Documentation (openapi yaml file)

- Docs at `/docs/api` (UI) and `/docs/api.json` (OpenAPI spec).
- Scramble infers from type hints, FormRequest rules, and API Resources — keep these accurate.
- Use `@response`/`@bodyParam` PHPDoc only when inference fails (polymorphic/union types).
- Use `@tags` on controllers to group endpoints. Use `#[ExcludeFromDocs]` to hide endpoints.
- Prefer `Route::apiResource` and named routes for clean doc output.

### Services (`app/Services/`)

External integrations (APIs, SDKs, notification providers). Injected into Actions. Every service gets a test.

## Frontend

### React Components

- Dark mode required (`dark:` variants). Mobile-first responsive (`sm:`/`md:`/`lg:`).
- Function components with typed props. Use `@/` alias for imports.
- Prefer Inertia's `<Form>` / `useForm` for mutations and `Link`/`router` for navigation (`@inertiajs/react`).
- Pages: `resources/js/pages/`. Components: `resources/js/components/`. Hooks: `resources/js/hooks/`.
- shadcn/ui primitives live in `resources/js/components/ui/`.
- Read component files before using them to understand their props API.
- kebab-case only for the file names in the frontend (component identifiers stay PascalCase).

### Hooks

- Reusable React hooks are stored in `resources/js/hooks/` (kebab-case files, e.g. `use-flash-toast.ts`) and documented in this section.

### Build

- NEVER run `npm run build`. Assume `npm run dev` is running.
- Vite manifest errors → ask user to restart `npm run dev`.

## Testing

- Target ~80% coverage: `phpcover ./vendor/bin/pest --coverage`
- Every Action and Service class gets a test.
- Feature tests for all controller endpoints.
- Use factories and model states — never manually build models.
- Activate `pest-testing` skill when working with tests.
- For architecture tests guide see `./docs/development/architecture-tests.md`

## Guards

- NEVER run `migrate:fresh` or `migrate:reset` without asking.
- NEVER run destructive git commands without asking.
- NEVER change dependencies without approval.
- NEVER create new top-level directories without approval.

<!-- BEGIN BEADS INTEGRATION v:1 profile:minimal hash:7510c1e2 -->
## Beads Issue Tracker

This project uses **bd (beads)** for issue tracking. Run `bd prime` to see full workflow context and commands.

### Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --claim  # Claim work
bd close <id>         # Complete work
```

### Rules

- Use `bd` for ALL task tracking — do NOT use TodoWrite, TaskCreate, or markdown TODO lists
- Run `bd prime` for detailed command reference and session close protocol
- Use `bd remember` for persistent knowledge — do NOT use MEMORY.md files

**Architecture in one line:** issues live in a local Dolt DB; sync uses `refs/dolt/data` on your git remote; `.beads/issues.jsonl` is a passive export. See https://github.com/gastownhall/beads/blob/main/docs/SYNC_CONCEPTS.md for details and anti-patterns.

## Session Completion

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY:
   ```bash
   git pull --rebase
   git push
   git status  # MUST show "up to date with origin"
   ```
5. **Clean up** - Clear stashes, prune remote branches
6. **Verify** - All changes committed AND pushed
7. **Hand off** - Provide context for next session

**CRITICAL RULES:**
- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing - that leaves work stranded locally
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds
<!-- END BEADS INTEGRATION -->
