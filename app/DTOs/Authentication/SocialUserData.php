<?php

namespace App\DTOs\Authentication;

readonly class SocialUserData
{
    public function __construct(
        public string $email,
        public string $name,
    ) {
        //
    }
}
