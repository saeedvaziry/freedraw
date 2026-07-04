<?php

namespace App\DTOs\Settings;

use App\Models\User;
use Illuminate\Contracts\Session\Session;

readonly class DeleteProfileData
{
    public function __construct(
        public User $user,
        public Session $session,
    ) {
        //
    }
}
