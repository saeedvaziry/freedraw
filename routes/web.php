<?php

use App\Http\Controllers\Organizations\OrganizationInvitationController;
use App\Http\Controllers\SocialLoginController;
use Illuminate\Support\Facades\Route;

Route::inertia('/', 'board')->name('home');

Route::inertia('/board', 'board')->name('board');

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
    Route::get('invitations/{invitation}/accept', [OrganizationInvitationController::class, 'accept'])->name('invitations.accept');
    Route::delete('invitations/{invitation}', [OrganizationInvitationController::class, 'decline'])->name('invitations.decline');
});

require __DIR__.'/settings.php';
