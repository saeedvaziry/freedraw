<?php

use App\Actions\Authentication\FindOrCreateSocialUser;
use App\Actions\Authentication\RegisterUser;
use App\Actions\Authentication\ResetUserPassword;
use App\Actions\Fortify\CreateNewUser;
use App\Actions\Fortify\ResetUserPassword as FortifyResetUserPassword;
use App\DTOs\Authentication\RegisterUserData;
use App\DTOs\Authentication\ResetPasswordData;
use App\DTOs\Authentication\SocialUserData;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;

uses(RefreshDatabase::class);

test('register user creates a personal organization', function () {
    $user = app(RegisterUser::class)->handle(new RegisterUserData(
        name: 'Taylor Otwell',
        email: 'taylor@example.com',
        password: 'password',
    ));

    expect($user)->toBeInstanceOf(User::class)
        ->and($user->organizations)->toHaveCount(1)
        ->and($user->currentOrganization->is_personal)->toBeTrue();
});

test('find or create social user verifies existing users', function () {
    $user = User::factory()->unverified()->create(['email' => 'person@example.com']);

    $result = app(FindOrCreateSocialUser::class)->handle(new SocialUserData(
        email: 'person@example.com',
        name: 'Person',
    ));

    expect($result->is($user))->toBeTrue()
        ->and($result->fresh()->email_verified_at)->not->toBeNull();
});

test('reset user password updates the hash', function () {
    $user = User::factory()->create();

    app(ResetUserPassword::class)->handle(new ResetPasswordData(
        user: $user,
        password: 'new-password',
    ));

    expect(Hash::check('new-password', $user->fresh()->password))->toBeTrue();
});

test('fortify create new user adapts input into the registration action', function () {
    $user = app(CreateNewUser::class)->create([
        'name' => 'Ada Lovelace',
        'email' => 'ada@example.com',
        'password' => 'password',
        'password_confirmation' => 'password',
    ]);

    expect($user)->toBeInstanceOf(User::class)
        ->and($user->currentOrganization->is_personal)->toBeTrue();
});

test('fortify reset user password adapts input into the reset action', function () {
    $user = User::factory()->create();

    app(FortifyResetUserPassword::class)->reset($user, [
        'password' => 'changed-password',
        'password_confirmation' => 'changed-password',
    ]);

    expect(Hash::check('changed-password', $user->fresh()->password))->toBeTrue();
});
