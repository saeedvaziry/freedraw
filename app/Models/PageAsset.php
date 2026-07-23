<?php

namespace App\Models;

use App\Http\Resources\Pages\PageAssetResource;
use Database\Factories\PageAssetFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\UseFactory;
use Illuminate\Database\Eloquent\Attributes\UseResource;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $page_id
 * @property string $asset_id
 * @property string $disk
 * @property string $path
 * @property string $content_hash
 * @property string $mime
 * @property int $size
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read Page $page
 */
#[Fillable(['page_id', 'asset_id', 'disk', 'path', 'content_hash', 'mime', 'size'])]
#[UseFactory(PageAssetFactory::class)]
#[UseResource(PageAssetResource::class)]
class PageAsset extends Model
{
    /** @use HasFactory<PageAssetFactory> */
    use HasFactory;

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
            'size' => 'integer',
        ];
    }
}
