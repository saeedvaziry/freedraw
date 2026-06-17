<?php

namespace App\Http\Responses\Concerns;

use App\Models\Organization;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\URL;

trait RedirectsToCurrentOrganization
{
    protected function redirectPathForCurrentOrganization(Request $request, string $redirect): string
    {
        $organization = $this->currentOrganization($request);

        URL::defaults(['current_organization' => $organization->slug]);

        return "/{$organization->slug}{$redirect}";
    }

    protected function currentOrganization(Request $request): Organization
    {
        $user = $request->user();

        abort_if(! $user, 403);

        $organization = $user->currentOrganization ?? $user->personalOrganization();

        abort_if(! $organization, 403);

        return $organization;
    }
}
