<?php

use App\DTOs\Authentication\SocialUserData;
use App\Models\OrganizationInvitation;
use App\Models\User;
use App\Notifications\Organizations\OrganizationInvitation as OrganizationInvitationNotification;
use App\Services\Authentication\SocialiteService;
use App\Services\Organizations\OrganizationInvitationNotifier;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Laravel\Socialite\Facades\Socialite;

uses(RefreshDatabase::class);

test('socialite service converts provider users into dto data', function () {
    $providerUser = Mockery::mock();
    $providerUser->shouldReceive('getEmail')->once()->andReturn('person@example.com');
    $providerUser->shouldReceive('getName')->once()->andReturn(null);
    $providerUser->shouldReceive('getNickname')->once()->andReturn('person');

    $driver = Mockery::mock();
    $driver->shouldReceive('user')->once()->andReturn($providerUser);

    Socialite::shouldReceive('driver')->with('github')->once()->andReturn($driver);

    $data = app(SocialiteService::class)->user('github');

    expect($data)->toBeInstanceOf(SocialUserData::class)
        ->and($data->email)->toBe('person@example.com')
        ->and($data->name)->toBe('person');
});

test('organization invitation notifier sends an on-demand notification', function () {
    Notification::fake();

    $invitation = OrganizationInvitation::factory()->create([
        'invited_by' => User::factory(),
    ]);

    app(OrganizationInvitationNotifier::class)->send($invitation);

    Notification::assertSentOnDemand(OrganizationInvitationNotification::class);
});
