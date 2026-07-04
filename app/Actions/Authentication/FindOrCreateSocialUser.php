<?php

namespace App\Actions\Authentication;

use App\DTOs\Authentication\RegisterUserData;
use App\DTOs\Authentication\SocialUserData;
use App\Models\User;

class FindOrCreateSocialUser
{
    public function __construct(private RegisterUser $registerUser)
    {
        //
    }

    public function handle(SocialUserData $data): User
    {
        $user = User::query()->where('email', $data->email)->first();

        if ($user) {
            if ($user->email_verified_at === null) {
                $user->forceFill(['email_verified_at' => now()])->save();
            }

            return $user;
        }

        $user = $this->registerUser->handle(new RegisterUserData(
            name: $data->name,
            email: $data->email,
            password: bcrypt(bin2hex(random_bytes(16))),
        ));

        $user->forceFill(['email_verified_at' => now()])->save();

        return $user;
    }
}
