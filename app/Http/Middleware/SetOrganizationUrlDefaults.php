<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\URL;
use Symfony\Component\HttpFoundation\Response;

class SetOrganizationUrlDefaults
{
    /**
     * Set the default URL parameters for organization-based routes.
     *
     * @param  Closure(Request): (Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        if ($currentOrganization = $request->user()?->currentOrganization) {
            URL::defaults([
                'current_organization' => $currentOrganization->slug,
                'organization' => $currentOrganization->slug,
            ]);
        }

        return $next($request);
    }
}
