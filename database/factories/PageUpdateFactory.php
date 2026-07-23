<?php

namespace Database\Factories;

use App\Models\Page;
use App\Models\PageUpdate;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<PageUpdate>
 */
class PageUpdateFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'page_id' => Page::factory(),
            'seq' => fake()->unique()->numberBetween(1, 1_000_000),
            'update' => "\x01\x02\xff\x10update-bytes",
            'origin' => fake()->uuid(),
        ];
    }
}
