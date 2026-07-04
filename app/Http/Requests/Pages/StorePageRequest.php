<?php

namespace App\Http\Requests\Pages;

use App\DTOs\Pages\CreatePageData;
use App\Models\User;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class StorePageRequest extends FormRequest
{
    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'title' => ['nullable', 'string', 'max:120'],
            'document' => ['nullable', 'string'],
        ];
    }

    public function toDto(): CreatePageData
    {
        return new CreatePageData(
            user: $this->authenticatedUser(),
            title: $this->validated('title'),
            document: $this->validated('document'),
        );
    }

    private function authenticatedUser(): User
    {
        $user = $this->user();

        abort_unless($user instanceof User, 403);

        return $user;
    }
}
