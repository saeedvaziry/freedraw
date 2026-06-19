<?php

use App\Http\Controllers\BoardController;
use App\Http\Controllers\Organizations\OrganizationInvitationController;
use App\Http\Controllers\PageController;
use App\Http\Controllers\SocialLoginController;
use Illuminate\Support\Facades\Route;

Route::get('/', [BoardController::class, 'home'])->name('home');

Route::get('/board', [BoardController::class, 'home'])->name('board');

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
    Route::delete('pages/{page}', [PageController::class, 'destroy'])->name('pages.destroy');

    Route::get('invitations/{invitation}/accept', [OrganizationInvitationController::class, 'accept'])->name('invitations.accept');
    Route::delete('invitations/{invitation}', [OrganizationInvitationController::class, 'decline'])->name('invitations.decline');
});

require __DIR__.'/settings.php';
