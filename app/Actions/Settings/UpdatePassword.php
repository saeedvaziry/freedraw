<?php

namespace App\Actions\Settings;

use App\DTOs\Settings\UpdatePasswordData;

class UpdatePassword
{
    public function handle(UpdatePasswordData $data): void
    {
        $data->user->update([
            'password' => $data->password,
        ]);
    }
}
