<?php

use App\Http\Controllers\Organizations\OrganizationInvitationController;
use Illuminate\Support\Facades\Route;

Route::inertia('/', 'board')->name('home');

Route::inertia('/board', 'board')->name('board');

Route::middleware(['auth'])->group(function () {
    Route::get('invitations/{invitation}/accept', [OrganizationInvitationController::class, 'accept'])->name('invitations.accept');
    Route::delete('invitations/{invitation}', [OrganizationInvitationController::class, 'decline'])->name('invitations.decline');
});

require __DIR__.'/settings.php';
