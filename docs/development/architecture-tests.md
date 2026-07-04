# Architecture Tests

FreeDraw uses architecture tests to keep the Laravel/Inertia codebase aligned with `AGENTS.md`.

Run them with:

```bash
php artisan test tests/Feature/Architecture --no-coverage
```

The tests enforce these project rules:

- Controllers stay thin: no inline validation or direct external facade integrations.
- FormRequests expose `toDto()` and return DTO classes.
- Actions expose `handle()` and accept a DTO as their first argument.
- Services and Actions have focused tests.
- Model metadata uses Laravel 13 attributes where the framework supports them.
- Frontend source files remain kebab-case and avoid inline SVG icons.

When adding a new endpoint, add the DTO, Action, Resource, and focused tests in the same change. If a rule needs an exception, document the reason in the architecture test instead of weakening the production code.
