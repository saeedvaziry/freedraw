<?php

namespace App\Actions\Settings;

use App\DTOs\Settings\UpdateProfileData;

class UpdateProfile
{
    public function handle(UpdateProfileData $data): void
    {
        $data->user->fill([
            'name' => $data->name,
            'email' => $data->email,
        ]);

        if ($data->user->isDirty('email')) {
            $data->user->email_verified_at = null;
        }

        $data->user->save();
    }
}
