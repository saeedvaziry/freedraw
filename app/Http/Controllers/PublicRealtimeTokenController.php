<?php

namespace App\Http\Controllers;

use App\Actions\Realtime\IssueRealtimeToken;
use App\Http\Requests\Realtime\PublicIssueRealtimeTokenRequest;
use Illuminate\Http\JsonResponse;

class PublicRealtimeTokenController extends Controller
{
    /**
     * Issue a short-lived read-only realtime token for a publicly shared page.
     */
    public function store(PublicIssueRealtimeTokenRequest $request, string $slug, IssueRealtimeToken $issueRealtimeToken): JsonResponse
    {
        $issued = $issueRealtimeToken->handle($request->toDto());

        return response()->json([
            'token' => $issued->token,
            'expiresAt' => $issued->expiresAt->toISOString(),
        ]);
    }
}
