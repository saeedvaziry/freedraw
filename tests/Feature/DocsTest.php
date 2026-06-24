<?php

test('diagram docs render at the canonical extensionless URL', function () {
    $this
        ->get('/docs/diagram')
        ->assertOk()
        ->assertSee('Diagram code', false)
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
