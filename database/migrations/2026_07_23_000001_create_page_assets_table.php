<?php

use App\Models\Page;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('page_assets', function (Blueprint $table) {
            $table->id();
            $table->foreignIdFor(Page::class)->constrained()->cascadeOnDelete();
            $table->string('asset_id');
            $table->string('disk');
            $table->string('path');
            $table->string('content_hash', 64)->index();
            $table->string('mime');
            $table->unsignedBigInteger('size');
            $table->timestamps();

            $table->unique(['page_id', 'asset_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('page_assets');
    }
};
