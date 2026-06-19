<?php

namespace App\Models;

use App\Enums\PagePermission;
use App\Enums\PageVisibility;
use Database\Factories\PageFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;

/**
 * @property int $id
 * @property string $public_id
 * @property int $organization_id
 * @property int|null $created_by
 * @property string $title
 * @property PageVisibility $visibility
 * @property PagePermission $permission
 * @property string|null $share_slug
 * @property string|null $document
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read Organization $organization
 * @property-read User|null $creator
 */
#[Fillable(['organization_id', 'created_by', 'title', 'visibility', 'permission', 'document'])]
class Page extends Model
{
    /** @use HasFactory<PageFactory> */
    use HasFactory;

    /**
     * The number of characters in a generated share slug.
     */
    private const SHARE_SLUG_LENGTH = 10;

    /**
     * The model's default attribute values.
     *
     * @var array<string, mixed>
     */
    protected $attributes = [
        'visibility' => PageVisibility::Private->value,
        'permission' => PagePermission::View->value,
    ];

    /**
     * Bootstrap the model and its traits.
     */
    protected static function boot(): void
    {
        parent::boot();

        static::creating(function (Page $page) {
            if (empty($page->public_id)) {
                $page->public_id = (string) Str::uuid();
            }
        });
    }

    /**
     * Get the organization that owns the page.
     *
     * @return BelongsTo<Organization, $this>
     */
    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }

    /**
     * Get the user who created the page.
     *
     * @return BelongsTo<User, $this>
     */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * Scope the query to pages the given user is allowed to see: their own,
     * organization- or publicly-shared pages in organizations they belong to,
     * and every page in organizations they administer.
     *
     * @param  Builder<Page>  $query
     */
    public function scopeVisibleTo(Builder $query, User $user): void
    {
        $memberOrgIds = $user->organizations()->pluck('organizations.id');
        $adminOrgIds = $user->administeredOrganizationIds();

        $query->where(function (Builder $query) use ($user, $memberOrgIds, $adminOrgIds) {
            $query
                ->where('created_by', $user->id)
                ->orWhereIn('organization_id', $adminOrgIds)
                ->orWhere(function (Builder $query) use ($memberOrgIds) {
                    $query
                        ->whereIn('organization_id', $memberOrgIds)
                        ->whereIn('visibility', [
                            PageVisibility::Organization->value,
                            PageVisibility::Public->value,
                        ]);
                });
        });
    }

    /**
     * Enable public sharing, generating a unique short slug when one is missing.
     */
    public function enablePublicSharing(): void
    {
        if (empty($this->share_slug)) {
            $this->share_slug = static::generateUniqueShareSlug();
        }
    }

    /**
     * Disable public sharing and drop the short slug.
     */
    public function disablePublicSharing(): void
    {
        $this->share_slug = null;
    }

    /**
     * Generate a share slug that is not already in use.
     */
    public static function generateUniqueShareSlug(): string
    {
        do {
            $slug = Str::lower(Str::random(self::SHARE_SLUG_LENGTH));
        } while (static::where('share_slug', $slug)->exists());

        return $slug;
    }

    /**
     * Get the route key for the model.
     */
    public function getRouteKeyName(): string
    {
        return 'public_id';
    }

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'visibility' => PageVisibility::class,
            'permission' => PagePermission::class,
        ];
    }
}
