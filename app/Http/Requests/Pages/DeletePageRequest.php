<?php

namespace App\Http\Requests\Pages;

use App\DTOs\Pages\DeletePageData;
use App\Models\Page;
use App\Models\User;
use Illuminate\Foundation\Http\FormRequest;

class DeletePageRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('delete', $this->page()) ?? false;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [];
    }

    public function toDto(): DeletePageData
    {
        return new DeletePageData(
            user: $this->authenticatedUser(),
            page: $this->page(),
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
