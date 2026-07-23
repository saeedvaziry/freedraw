<?php

namespace Database\Factories;

use App\Models\Page;
use App\Models\PageSnapshot;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<PageSnapshot>
 */
class PageSnapshotFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'page_id' => Page::factory(),
            'state' => "\x01\x02\xff\x10snapshot-state",
            'up_to_seq' => fake()->numberBetween(1, 1_000_000),
            'label' => null,
            'created_by' => User::factory(),
        ];
    }

    public function labelled(string $label): static
    {
        return $this->state(fn () => ['label' => $label]);
    }
}
