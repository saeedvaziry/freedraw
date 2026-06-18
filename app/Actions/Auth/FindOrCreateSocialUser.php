<?php

namespace App\Actions\Auth;

use App\Actions\Organizations\CreateOrganization;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Laravel\Socialite\Contracts\User as SocialiteUser;

class FindOrCreateSocialUser
{
    public function __construct(private CreateOrganization $createOrganization)
    {
        //
    }

    /**
     * Find an existing user by email or create a new one from the social profile.
     *
     * Existing users without a verified email are marked as verified, since the
     * social provider has already confirmed ownership of the address. New users
     * are given a personal organization, mirroring registration.
     */
    public function execute(SocialiteUser $socialUser): User
    {
        $user = User::query()->where('email', $socialUser->getEmail())->first();

        if ($user) {
            if ($user->email_verified_at === null) {
                $user->forceFill(['email_verified_at' => now()])->save();
            }

            return $user;
        }

        return DB::transaction(function () use ($socialUser) {
            $name = $socialUser->getName() ?? $socialUser->getNickname() ?? $socialUser->getEmail();

            $user = User::create([
                'name' => $name,
                'email' => $socialUser->getEmail(),
                'password' => bcrypt(bin2hex(random_bytes(16))),
            ]);

            // email_verified_at is not mass assignable, so set it explicitly.
            $user->forceFill(['email_verified_at' => now()])->save();

            $this->createOrganization->handle($user, $name."'s Organization", isPersonal: true);

            return $user;
        });
    }
}
