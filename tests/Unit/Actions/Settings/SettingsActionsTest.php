<?php

use App\Actions\Settings\DeleteProfile;
use App\Actions\Settings\UpdatePassword;
use App\Actions\Settings\UpdateProfile;
use App\DTOs\Settings\DeleteProfileData;
use App\DTOs\Settings\UpdatePasswordData;
use App\DTOs\Settings\UpdateProfileData;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;

uses(RefreshDatabase::class);

test('update profile clears verification when email changes', function () {
    $user = User::factory()->create(['email_verified_at' => now()]);

    app(UpdateProfile::class)->handle(new UpdateProfileData(
        user: $user,
        name: 'Updated',
        email: 'updated@example.com',
    ));

    expect($user->fresh()->name)->toBe('Updated')
        ->and($user->fresh()->email_verified_at)->toBeNull();
});

test('update password stores a hashed password', function () {
    $user = User::factory()->create();

    app(UpdatePassword::class)->handle(new UpdatePasswordData($user, 'new-password'));

    expect(Hash::check('new-password', $user->fresh()->password))->toBeTrue();
});

test('delete profile removes the user and invalidates the session', function () {
    $user = User::factory()->create();

    $this->actingAs($user);

    app(DeleteProfile::class)->handle(new DeleteProfileData($user, $this->app['session.store']));

    expect(User::whereKey($user->id)->exists())->toBeFalse()
        ->and(auth()->check())->toBeFalse();
});
