# FreeDraw

FreeDraw is a very lightweight open-source and self-hostable web app. It is a lightweight alternative to LucidCharts, OpenDraw, ...

## Idea

a lightweight web app for drawing charts. the app doesnt need auth, it works totally on the browser. 
it uses browser db for to keep drawings so refresh wouldnt lose them. 
there is only one board to draw, no projects, folders, ... needed.

we need a toolbar, user can select shapes, draw them, add labels with double click, guides on drawing arrows, being able to modify arrows, their shape, color, size, ...

guides and hovering shapes to make a new shape connected to it, ...

## Tech Stack

- Monorepo with turbo
- SPA React app with React router
- Tailwindcss
- Drawing surface is HTML5 Canvas 2D
- NPM, and always with `--ignore-scripts`
- Shadcn components

## Top Level Rules

- Security
- Maintainability
- Scalability
- Clean Code
- Clean Architecture
- Best Practices
- No Hacky Solutions
- Less code and re-usable components

## Main Rules

- No commenting allowed in the codebase
- All code must be self-explanatory and cleanly structured
- Use early returns instead of nested conditionals
- Don't patch symptoms, fix root causes
- For every task, Consider how it will impact the architecture and code quality, not just the immediate problem
- Follow the existing code's pattern but offer refactors if they improve code quality and maintainability.
- Use logs for debugging.
- If the feature is testable, then you must write tests.
- Avoid long PR descriptions. It is for humans and keep it in 3 lines maximum.
- Upload screenshots or recordings for the PRs.
- Never answer any question without a proper investigation and exploring the codebase.
- Prioritize problem comprehension over premature implementation. Validate the approach before execution to avoid rework
- Plan properly before executing to not double work
- Simpler, flexible and scalable approaches are key factors

## Notes

- Run everything through an opus agent.
