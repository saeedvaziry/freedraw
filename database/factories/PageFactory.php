<?php

namespace Database\Factories;

use App\Enums\PagePermission;
use App\Enums\PageVisibility;
use App\Models\Organization;
use App\Models\Page;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<Page>
 */
class PageFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'organization_id' => Organization::factory(),
            'created_by' => User::factory(),
            'title' => fake()->words(2, true),
            'document' => null,
        ];
    }

    /**
     * Share the page with the whole organization.
     */
    public function sharedWithOrganization(PagePermission $permission = PagePermission::View): static
    {
        return $this->state(fn () => [
            'visibility' => PageVisibility::Organization,
            'permission' => $permission,
        ]);
    }

    /**
     * Publish the page publicly with a share slug.
     */
    public function public(): static
    {
        return $this->state(fn () => [
            'visibility' => PageVisibility::Public,
            'permission' => PagePermission::View,
            'share_slug' => Str::lower(Str::random(10)),
        ]);
    }
}
