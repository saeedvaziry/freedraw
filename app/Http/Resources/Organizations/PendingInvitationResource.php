<?php

namespace App\Http\Resources\Organizations;

use App\Models\OrganizationInvitation;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin OrganizationInvitation
 */
class PendingInvitationResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'code' => $this->code,
            'inviterName' => $this->inviter->name,
            'organization' => [
                'name' => $this->organization->name,
                'slug' => $this->organization->slug,
            ],
        ];
    }
}
