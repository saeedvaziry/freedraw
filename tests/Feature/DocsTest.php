<?php

test('diagram docs render at the canonical extensionless URL', function () {
    $this
        ->get('/docs/diagram')
        ->assertOk()
        ->assertSee('Diagram code', false)
        ->assertSee('/docs/packages/diagram', false)
        ->assertSee('npx skills add github.com/saeedvaziry/freedraw/tree/main/skills/freedraw-diagram-code', false)
        ->assertSee('/docs/SKILL.md', false);
});

test('old diagram docs HTML URL redirects to the canonical URL', function () {
    $this
        ->get('/docs/diagram.html')
        ->assertRedirect('/docs/diagram');
});

test('diagram skill file is available for download', function () {
    $this
        ->get('/docs/SKILL.md')
        ->assertOk()
        ->assertSee('# FreeDraw Diagram Code', false);
});

test('diagram skill is kept in a skill-only directory', function () {
    expect(glob(base_path('skills/freedraw-diagram-code/*')))
        ->toBe([base_path('skills/freedraw-diagram-code/SKILL.md')]);
});

test('diagram package docs render from the package readme', function () {
    $this
        ->get('/docs/packages/diagram')
        ->assertOk()
        ->assertSee('@freedraw/diagram', false)
        ->assertSee('renderToCanvas', false)
        ->assertSee('github.com/saeedvaziry/freedraw/tree/main/skills/freedraw-diagram-code', false)
        ->assertSee('mount', false);
});

test('old diagram package docs URL redirects to the canonical URL', function () {
    $this
        ->get('/docs/diagram-package')
        ->assertRedirect('/docs/packages/diagram');
});
