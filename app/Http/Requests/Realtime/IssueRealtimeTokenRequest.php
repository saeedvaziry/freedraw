<?php

namespace App\Http\Requests\Realtime;

use App\DTOs\Realtime\IssueRealtimeTokenData;
use App\Models\Page;
use Illuminate\Foundation\Http\FormRequest;

class IssueRealtimeTokenRequest extends FormRequest
{
    public function authorize(): bool
    {
        abort_unless((bool) config('services.collab.enabled'), 404);

        return $this->user()?->can('view', $this->page()) ?? false;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [];
    }

    public function toDto(): IssueRealtimeTokenData
    {
        $page = $this->page();

        return new IssueRealtimeTokenData(
            room: $page->public_id,
            uid: $this->user()?->id,
            canEdit: $this->user()?->can('update', $page) ?? false,
        );
    }

    private function page(): Page
    {
        $page = $this->route('page');

        abort_unless($page instanceof Page, 404);

        return $page;
    }
}
