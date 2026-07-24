<?php

namespace App\Http\Requests\Realtime;

use App\DTOs\Realtime\IssueRealtimeTokenData;
use App\Enums\PageVisibility;
use App\Models\Page;
use Illuminate\Foundation\Http\FormRequest;

class PublicIssueRealtimeTokenRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
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
        return new IssueRealtimeTokenData(
            room: $this->page()->public_id,
            uid: null,
            canEdit: false,
        );
    }

    private function page(): Page
    {
        return Page::query()
            ->where('share_slug', $this->route('slug'))
            ->where('visibility', PageVisibility::Public->value)
            ->firstOrFail();
    }
}
