<?php

namespace App\Http\Controllers;

use App\Actions\Realtime\IssueRealtimeToken;
use App\Http\Requests\Realtime\IssueRealtimeTokenRequest;
use App\Models\Page;
use Illuminate\Http\JsonResponse;
use Illuminate\Routing\Attributes\Controllers\Middleware;

#[Middleware('auth')]
class RealtimeTokenController extends Controller
{
    /**
     * Issue a short-lived realtime collaboration token for the page.
     */
    public function store(IssueRealtimeTokenRequest $request, Page $page, IssueRealtimeToken $issueRealtimeToken): JsonResponse
    {
        $issued = $issueRealtimeToken->handle($request->toDto());

        return response()->json([
            'token' => $issued->token,
            'expiresAt' => $issued->expiresAt->toISOString(),
        ]);
    }
}
