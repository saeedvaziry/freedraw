<?php

namespace App\Actions\Authentication;

use App\Actions\Organizations\CreateOrganization;
use App\DTOs\Authentication\RegisterUserData;
use App\DTOs\Organizations\CreateOrganizationData;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class RegisterUser
{
    public function __construct(private CreateOrganization $createOrganization)
    {
        //
    }

    public function handle(RegisterUserData $data): User
    {
        return DB::transaction(function () use ($data) {
            $user = User::create([
                'name' => $data->name,
                'email' => $data->email,
                'password' => $data->password,
            ]);

            $this->createOrganization->handle(new CreateOrganizationData(
                user: $user,
                name: $user->name."'s Organization",
                isPersonal: true,
            ));

            return $user;
        });
    }
}
