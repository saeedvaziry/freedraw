<?php

use App\Models\User;
use Laravel\Socialite\Contracts\Provider;
use Laravel\Socialite\Contracts\User as SocialiteUser;
use Laravel\Socialite\Facades\Socialite;

test('redirect route sends the user to the provider', function (string $provider) {
    $mock = Mockery::mock(Provider::class);
    $mock->shouldReceive('redirect')->once()->andReturn(redirect('https://provider.test/auth'));

    Socialite::shouldReceive('driver')->with($provider)->once()->andReturn($mock);

    $this->get("/login/{$provider}")->assertRedirect('https://provider.test/auth');
})->with(['github', 'google']);

test('unsupported providers return a 404', function () {
    $this->get('/login/facebook')->assertNotFound();
    $this->get('/login/facebook/callback')->assertNotFound();
});

test('callback creates a new user with a personal organization and logs them in', function (string $provider) {
    mockSocialiteUser($provider, name: 'Ada Lovelace', email: 'ada@example.com');

    $this->get("/login/{$provider}/callback")->assertRedirect('/');

    $user = User::query()->where('email', 'ada@example.com')->firstOrFail();

    expect($user->name)->toBe('Ada Lovelace')
        ->and($user->email_verified_at)->not->toBeNull()
        ->and($user->currentOrganization)->not->toBeNull()
        ->and($user->currentOrganization->is_personal)->toBeTrue();

    $this->assertAuthenticatedAs($user);
})->with(['github', 'google']);

test('callback logs in an existing user without creating a duplicate', function () {
    $existing = User::factory()->create([
        'email' => 'ada@example.com',
        'email_verified_at' => null,
    ]);

    mockSocialiteUser('github', name: 'Ada Lovelace', email: 'ada@example.com');

    $this->get('/login/github/callback')->assertRedirect('/');

    expect(User::query()->where('email', 'ada@example.com')->count())->toBe(1);

    $existing->refresh();
    expect($existing->email_verified_at)->not->toBeNull();

    $this->assertAuthenticatedAs($existing);
});

/**
 * Bind a fake Socialite driver that returns the given social profile.
 */
function mockSocialiteUser(string $provider, string $name, string $email): void
{
    $socialUser = Mockery::mock(SocialiteUser::class);
    $socialUser->shouldReceive('getEmail')->andReturn($email);
    $socialUser->shouldReceive('getName')->andReturn($name);
    $socialUser->shouldReceive('getNickname')->andReturn(null);

    $driver = Mockery::mock(Provider::class);
    $driver->shouldReceive('user')->once()->andReturn($socialUser);

    Socialite::shouldReceive('driver')->with($provider)->once()->andReturn($driver);
}
