<?php

use App\Enums\PagePermission;
use App\Enums\PageVisibility;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('pages', function (Blueprint $table) {
            $table->string('visibility')->default(PageVisibility::Private->value)->after('title');
            $table->string('permission')->default(PagePermission::View->value)->after('visibility');
            $table->string('share_slug')->nullable()->unique()->after('permission');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('pages', function (Blueprint $table) {
            $table->dropUnique(['share_slug']);
            $table->dropColumn(['visibility', 'permission', 'share_slug']);
        });
    }
};
