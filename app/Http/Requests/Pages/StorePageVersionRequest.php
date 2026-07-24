<?php

namespace App\Http\Requests\Pages;

use App\DTOs\Pages\CreateNamedSnapshotData;
use App\Models\Page;
use App\Models\User;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class StorePageVersionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('update', $this->page()) ?? false;
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'label' => ['required', 'string', 'max:120'],
        ];
    }

    public function toDto(): CreateNamedSnapshotData
    {
        return new CreateNamedSnapshotData(
            page: $this->page(),
            user: $this->authenticatedUser(),
            label: (string) $this->validated('label'),
        );
    }

    private function page(): Page
    {
        $page = $this->route('page');

        abort_unless($page instanceof Page, 404);

        return $page;
    }

    private function authenticatedUser(): User
    {
        $user = $this->user();

        abort_unless($user instanceof User, 403);

        return $user;
    }
}
