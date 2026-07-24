<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('page_assets', function (Blueprint $table) {
            $table->timestamp('referenced_at')->nullable()->after('size');
        });
    }

    public function down(): void
    {
        Schema::table('page_assets', function (Blueprint $table) {
            $table->dropColumn('referenced_at');
        });
    }
};
