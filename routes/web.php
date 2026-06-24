<?php

use App\Http\Controllers\BoardController;
use App\Http\Controllers\Organizations\OrganizationInvitationController;
use App\Http\Controllers\PageController;
use App\Http\Controllers\PageShareController;
use App\Http\Controllers\PublicPageController;
use App\Http\Controllers\SocialLoginController;
use Illuminate\Support\Facades\Route;

Route::get('/', [BoardController::class, 'home'])->name('home');

Route::get('/board', [BoardController::class, 'home'])->name('board');

Route::get('/docs/diagram', fn () => response(file_get_contents(resource_path('docs/diagram.html')), 200, [
    'Content-Type' => 'text/html; charset=UTF-8',
]))
    ->name('docs.diagram');
Route::redirect('/docs/diagram.html', '/docs/diagram');
Route::get('/docs/SKILL.md', fn () => response(file_get_contents(resource_path('docs/SKILL.md')), 200, [
    'Content-Type' => 'text/markdown; charset=UTF-8',
]));

// Public share links (open to anyone, read-only).
Route::get('s/{slug}', [PublicPageController::class, 'show'])->name('share.show');

// Social Login (GitHub, Google)
Route::middleware('guest')->group(function () {
    Route::get('/login/{provider}', [SocialLoginController::class, 'redirect'])
        ->whereIn('provider', ['github', 'google'])
        ->name('social.redirect');
    Route::get('/login/{provider}/callback', [SocialLoginController::class, 'callback'])
        ->whereIn('provider', ['github', 'google'])
        ->name('social.callback');
});

Route::middleware(['auth'])->group(function () {
    Route::get('pages/{page}', [BoardController::class, 'show'])->name('pages.show');
    Route::post('pages', [PageController::class, 'store'])->name('pages.store');
    Route::patch('pages/{page}', [PageController::class, 'update'])->name('pages.update');
    Route::patch('pages/{page}/share', [PageShareController::class, 'update'])->name('pages.share');
    Route::delete('pages/{page}', [PageController::class, 'destroy'])->name('pages.destroy');

    Route::get('invitations/{invitation}/accept', [OrganizationInvitationController::class, 'accept'])->name('invitations.accept');
    Route::delete('invitations/{invitation}', [OrganizationInvitationController::class, 'decline'])->name('invitations.decline');
});

require __DIR__.'/settings.php';
