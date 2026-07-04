<?php

namespace App\Actions\Settings;

use App\DTOs\Settings\DeleteProfileData;
use Illuminate\Support\Facades\Auth;

class DeleteProfile
{
    public function handle(DeleteProfileData $data): void
    {
        Auth::logout();

        $data->user->delete();

        $data->session->invalidate();
        $data->session->regenerateToken();
    }
}
