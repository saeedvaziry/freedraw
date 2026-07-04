<?php

namespace App\Actions\Authentication;

use App\DTOs\Authentication\ResetPasswordData;

class ResetUserPassword
{
    public function handle(ResetPasswordData $data): void
    {
        $data->user->forceFill([
            'password' => $data->password,
        ])->save();
    }
}
