<?php

namespace App\Models;

use Database\Factories\PageSnapshotFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\UseFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $page_id
 * @property string $state
 * @property int $up_to_seq
 * @property string|null $label
 * @property int|null $created_by
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read Page $page
 * @property-read User|null $creator
 */
#[Fillable(['page_id', 'state', 'up_to_seq', 'label', 'created_by'])]
#[UseFactory(PageSnapshotFactory::class)]
class PageSnapshot extends Model
{
    /** @use HasFactory<PageSnapshotFactory> */
    use HasFactory;

    /**
     * @return BelongsTo<Page, $this>
     */
    public function page(): BelongsTo
    {
        return $this->belongsTo(Page::class);
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'up_to_seq' => 'integer',
        ];
    }
}
