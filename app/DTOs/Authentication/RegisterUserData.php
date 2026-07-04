<?php

namespace App\DTOs\Authentication;

readonly class RegisterUserData
{
    public function __construct(
        public string $name,
        public string $email,
        public string $password,
    ) {
        //
    }
}
