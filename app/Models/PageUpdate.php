<?php

namespace App\Models;

use Database\Factories\PageUpdateFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\UseFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $page_id
 * @property int $seq
 * @property string $update
 * @property string|null $origin
 * @property Carbon|null $created_at
 * @property-read Page $page
 */
#[Fillable(['page_id', 'seq', 'update', 'origin'])]
#[UseFactory(PageUpdateFactory::class)]
class PageUpdate extends Model
{
    /** @use HasFactory<PageUpdateFactory> */
    use HasFactory;

    public const UPDATED_AT = null;

    /**
     * @return BelongsTo<Page, $this>
     */
    public function page(): BelongsTo
    {
        return $this->belongsTo(Page::class);
    }

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'seq' => 'integer',
        ];
    }
}
