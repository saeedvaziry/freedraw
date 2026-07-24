<?php

namespace Database\Factories;

use App\Models\Page;
use App\Models\PageAsset;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<PageAsset>
 */
class PageAssetFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $hash = hash('sha256', (string) Str::uuid());

        return [
            'page_id' => Page::factory(),
            'asset_id' => (string) Str::uuid(),
            'disk' => 'assets',
            'path' => sprintf('%s/%s/%s', substr($hash, 0, 2), substr($hash, 2, 2), $hash),
            'content_hash' => $hash,
            'mime' => 'image/png',
            'size' => fake()->numberBetween(1024, 1024 * 512),
        ];
    }

    public function referenced(): static
    {
        return $this->state(fn (array $attributes) => [
            'referenced_at' => now(),
        ]);
    }
}
