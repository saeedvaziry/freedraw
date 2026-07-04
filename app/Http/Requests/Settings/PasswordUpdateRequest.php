<?php

namespace App\Http\Requests\Settings;

use App\Concerns\PasswordValidationRules;
use App\DTOs\Settings\UpdatePasswordData;
use App\Models\User;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class PasswordUpdateRequest extends FormRequest
{
    use PasswordValidationRules;

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'current_password' => $this->currentPasswordRules(),
            'password' => $this->passwordRules(),
        ];
    }

    public function toDto(): UpdatePasswordData
    {
        return new UpdatePasswordData(
            user: $this->authenticatedUser(),
            password: $this->validated('password'),
        );
    }

    private function authenticatedUser(): User
    {
        $user = $this->user();

        abort_unless($user instanceof User, 403);

        return $user;
    }
}
