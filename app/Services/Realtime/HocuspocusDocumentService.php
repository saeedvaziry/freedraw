<?php

namespace App\Services\Realtime;

use App\DTOs\Realtime\PageDocumentState;
use App\Models\Page;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;

class HocuspocusDocumentService
{
    public function isConfigured(): bool
    {
        return $this->baseUrl() !== '' && $this->secret() !== '';
    }

    public function fold(Page $page): ?PageDocumentState
    {
        return $this->call($page, 'fold', []);
    }

    public function restore(Page $page, string $state): ?PageDocumentState
    {
        return $this->call($page, 'restore', ['state' => base64_encode($state)]);
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    private function call(Page $page, string $operation, array $payload): ?PageDocumentState
    {
        if (! $this->isConfigured()) {
            return null;
        }

        try {
            $response = Http::withToken($this->secret())
                ->timeout($this->timeout())
                ->acceptJson()
                ->asJson()
                ->post($this->endpoint($page, $operation), $payload);
        } catch (Throwable $exception) {
            Log::warning('The Hocuspocus service could not be reached.', [
                'page' => $page->public_id,
                'operation' => $operation,
                'message' => $exception->getMessage(),
            ]);

            return null;
        }

        if (! $response->successful()) {
            Log::warning('The Hocuspocus service refused a document request.', [
                'page' => $page->public_id,
                'operation' => $operation,
                'status' => $response->status(),
            ]);

            return null;
        }

        return $this->toDocumentState($page, $operation, $response);
    }

    private function toDocumentState(Page $page, string $operation, Response $response): ?PageDocumentState
    {
        $state = $response->json('state');
        $upToSeq = $response->json('upToSeq');

        $decoded = is_string($state) ? base64_decode($state, true) : false;

        if ($decoded === false || $decoded === '' || ! is_numeric($upToSeq)) {
            Log::warning('The Hocuspocus service returned an unusable document state.', [
                'page' => $page->public_id,
                'operation' => $operation,
            ]);

            return null;
        }

        return new PageDocumentState($decoded, (int) $upToSeq);
    }

    private function endpoint(Page $page, string $operation): string
    {
        return $this->baseUrl().'/internal/pages/'.rawurlencode($page->public_id).'/'.$operation;
    }

    private function baseUrl(): string
    {
        return rtrim((string) config('services.collab.internal_url'), '/');
    }

    private function secret(): string
    {
        return (string) config('services.collab.internal_secret');
    }

    private function timeout(): int
    {
        return max(1, (int) config('services.collab.internal_timeout', 10));
    }
}
