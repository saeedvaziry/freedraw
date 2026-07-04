<?php

namespace App\Http\Requests\Settings;

use App\Concerns\ProfileValidationRules;
use App\DTOs\Settings\UpdateProfileData;
use App\Models\User;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class ProfileUpdateRequest extends FormRequest
{
    use ProfileValidationRules;

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return $this->profileRules($this->user()->id);
    }

    public function toDto(): UpdateProfileData
    {
        return new UpdateProfileData(
            user: $this->authenticatedUser(),
            name: $this->validated('name'),
            email: $this->validated('email'),
        );
    }

    private function authenticatedUser(): User
    {
        $user = $this->user();

        abort_unless($user instanceof User, 403);

        return $user;
    }
}
