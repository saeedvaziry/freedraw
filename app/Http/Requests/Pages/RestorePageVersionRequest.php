<?php

namespace App\Http\Requests\Pages;

use App\DTOs\Pages\RestorePageVersionData;
use App\Models\Page;
use App\Models\User;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class RestorePageVersionRequest extends FormRequest
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
            'version_id' => [
                'required',
                'integer',
                Rule::exists('page_snapshots', 'id')
                    ->where('page_id', $this->page()->id)
                    ->whereNotNull('label'),
            ],
        ];
    }

    public function toDto(): RestorePageVersionData
    {
        $page = $this->page();

        return new RestorePageVersionData(
            page: $page,
            user: $this->authenticatedUser(),
            version: $page->snapshots()
                ->whereNotNull('label')
                ->findOrFail((int) $this->validated('version_id')),
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
