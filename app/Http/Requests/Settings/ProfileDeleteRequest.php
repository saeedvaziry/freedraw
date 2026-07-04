<?php

namespace App\Http\Requests\Settings;

use App\Concerns\PasswordValidationRules;
use App\DTOs\Settings\DeleteProfileData;
use App\Models\User;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class ProfileDeleteRequest extends FormRequest
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
            'password' => $this->currentPasswordRules(),
        ];
    }

    public function toDto(): DeleteProfileData
    {
        return new DeleteProfileData(
            user: $this->authenticatedUser(),
            session: $this->session(),
        );
    }

    private function authenticatedUser(): User
    {
        $user = $this->user();

        abort_unless($user instanceof User, 403);

        return $user;
    }
}
