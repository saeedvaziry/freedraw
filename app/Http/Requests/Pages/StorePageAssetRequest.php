<?php

namespace App\Http\Requests\Pages;

use App\DTOs\Pages\UploadPageAssetData;
use App\Models\Page;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Http\UploadedFile;

class StorePageAssetRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('update', $this->page()) ?? false;
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'asset_id' => ['required', 'string', 'max:191'],
            'file' => ['required', 'file', 'mimetypes:image/jpeg,image/png,image/gif,image/webp', 'max:10240'],
        ];
    }

    public function toDto(): UploadPageAssetData
    {
        $file = $this->file('file');

        abort_unless($file instanceof UploadedFile, 422);

        return new UploadPageAssetData(
            page: $this->page(),
            assetId: (string) $this->validated('asset_id'),
            file: $file,
        );
    }

    private function page(): Page
    {
        $page = $this->route('page');

        abort_unless($page instanceof Page, 404);

        return $page;
    }
}
