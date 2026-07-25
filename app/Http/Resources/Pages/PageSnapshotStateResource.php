<?php

namespace App\Http\Resources\Pages;

use App\Models\PageSnapshot;
use Illuminate\Http\Request;

/**
 * @mixin PageSnapshot
 */
class PageSnapshotStateResource extends PageSnapshotResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            ...parent::toArray($request),
            'state' => base64_encode($this->state),
        ];
    }
}
