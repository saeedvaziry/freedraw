<?php

namespace App\Http\Requests\Settings;

use App\DTOs\Settings\TwoFactorAuthenticationData;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Laravel\Fortify\InteractsWithTwoFactorState;

class TwoFactorAuthenticationRequest extends FormRequest
{
    use InteractsWithTwoFactorState;

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [];
    }

    public function toDto(): TwoFactorAuthenticationData
    {
        return new TwoFactorAuthenticationData;
    }
}
