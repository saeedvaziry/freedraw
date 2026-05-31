---
name: ship
description: Use this skill to ship features
---

## Steps

1. Plan the requested feature by considering the rules in the CLAUDE.md
2. Ask question if needed to finalize the plan only using the question tool
3. Implement the plan by sticking to the rules of the CLAUDE.md in a way that if I ask another agent for review, We don't get required changes.
4. When finished, Share guides with the user what to test
5. When confirmed the feature working, Share a PR title and very short PR description

## Guides

- Keep the communication to the user as short as possible with less reads
- Use question tool if you need to ask questions
- The proper approach is not between options. It is always one single approach.
- Existing code is not 100% correct. So we are open for new approaches

## Important

- Run output through an opus agent
- Make sure you have a complete picture of the imlpementation on the plan mode to not stop and change the approach or hit blockers.
