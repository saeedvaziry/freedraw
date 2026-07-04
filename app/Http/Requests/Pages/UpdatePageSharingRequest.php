<?php

namespace App\Http\Requests\Pages;

use App\DTOs\Pages\UpdatePageSharingData;
use App\Enums\PagePermission;
use App\Enums\PageVisibility;
use App\Models\Page;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rules\Enum;

class UpdatePageSharingRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('share', $this->page()) ?? false;
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'visibility' => ['required', new Enum(PageVisibility::class)],
            'permission' => ['required', new Enum(PagePermission::class)],
        ];
    }

    public function toDto(): UpdatePageSharingData
    {
        return new UpdatePageSharingData(
            page: $this->page(),
            visibility: PageVisibility::from($this->validated('visibility')),
            permission: PagePermission::from($this->validated('permission')),
        );
    }

    private function page(): Page
    {
        $page = $this->route('page');

        abort_unless($page instanceof Page, 404);

        return $page;
    }
}
