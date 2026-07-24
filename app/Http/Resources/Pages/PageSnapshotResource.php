<?php

namespace App\Http\Resources\Pages;

use App\Models\PageSnapshot;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin PageSnapshot
 */
class PageSnapshotResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'label' => $this->label,
            'upToSeq' => $this->up_to_seq,
            'createdAt' => $this->created_at?->toISOString(),
            'creator' => $this->creator ? [
                'id' => $this->creator->id,
                'name' => $this->creator->name,
            ] : null,
        ];
    }
}
