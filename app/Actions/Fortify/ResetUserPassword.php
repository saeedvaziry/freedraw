<?php

namespace App\Actions\Fortify;

use App\Actions\Authentication\ResetUserPassword as ResetUserPasswordAction;
use App\Concerns\PasswordValidationRules;
use App\DTOs\Authentication\ResetPasswordData;
use App\Models\User;
use Illuminate\Support\Facades\Validator;
use Laravel\Fortify\Contracts\ResetsUserPasswords;

class ResetUserPassword implements ResetsUserPasswords
{
    use PasswordValidationRules;

    public function __construct(private ResetUserPasswordAction $resetUserPassword)
    {
        //
    }

    /**
     * @param  array<string, string>  $input
     */
    public function reset(User $user, array $input): void
    {
        Validator::make($input, [
            'password' => $this->passwordRules(),
        ])->validate();

        $this->handle(new ResetPasswordData(
            user: $user,
            password: $input['password'],
        ));
    }

    public function handle(ResetPasswordData $data): void
    {
        $this->resetUserPassword->handle($data);
    }
}
