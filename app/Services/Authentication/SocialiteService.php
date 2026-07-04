<?php

namespace App\Services\Authentication;

use App\DTOs\Authentication\SocialUserData;
use Laravel\Socialite\Facades\Socialite;
use Symfony\Component\HttpFoundation\RedirectResponse;

class SocialiteService
{
    public function redirect(string $provider): RedirectResponse
    {
        return Socialite::driver($provider)->redirect();
    }

    public function user(string $provider): SocialUserData
    {
        $socialUser = Socialite::driver($provider)->user();

        $email = $socialUser->getEmail();

        abort_unless(is_string($email) && $email !== '', 422, __('The social provider did not return an email address.'));

        return new SocialUserData(
            email: $email,
            name: $socialUser->getName() ?? $socialUser->getNickname() ?? $email,
        );
    }
}
