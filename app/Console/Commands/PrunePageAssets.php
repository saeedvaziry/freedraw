<?php

namespace App\Console\Commands;

use App\Actions\Pages\PrunePageAssets as PrunePageAssetsAction;
use App\DTOs\Pages\PrunePageAssetsData;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;

#[Signature('assets:prune {--older-than=7 : The minimum age in days before an unreferenced asset is pruned.}')]
#[Description('Delete orphaned page assets and their unreferenced files.')]
class PrunePageAssets extends Command
{
    public function handle(PrunePageAssetsAction $prunePageAssets): int
    {
        $result = $prunePageAssets->handle(new PrunePageAssetsData(
            olderThanDays: (int) $this->option('older-than'),
        ));

        $this->components->info(__('Pruned :rows page assets, deleted :files files, kept :kept shared files.', [
            'rows' => $result->rowsDeleted,
            'files' => $result->filesDeleted,
            'kept' => $result->filesKept,
        ]));

        return self::SUCCESS;
    }
}
