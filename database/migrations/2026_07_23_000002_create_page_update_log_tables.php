<?php

use App\Models\Page;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('page_updates', function (Blueprint $table) {
            $table->id();
            $table->foreignIdFor(Page::class)->constrained()->cascadeOnDelete();
            $table->unsignedBigInteger('seq');
            $table->binary('update');
            $table->string('origin')->nullable();
            $table->timestamp('created_at')->nullable();

            $table->unique(['page_id', 'seq']);
        });

        Schema::create('page_snapshots', function (Blueprint $table) {
            $table->id();
            $table->foreignIdFor(Page::class)->constrained()->cascadeOnDelete();
            $table->binary('state');
            $table->unsignedBigInteger('up_to_seq');
            $table->string('label')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['page_id', 'up_to_seq']);
        });

        if (DB::connection()->getDriverName() === 'mysql') {
            DB::statement('ALTER TABLE page_updates MODIFY `update` MEDIUMBLOB NOT NULL');
            DB::statement('ALTER TABLE page_snapshots MODIFY `state` LONGBLOB NOT NULL');
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('page_snapshots');
        Schema::dropIfExists('page_updates');
    }
};
