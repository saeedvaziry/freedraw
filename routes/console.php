<?php

use Illuminate\Support\Facades\Schedule;

Schedule::command('organizations:prune-expired-invitations')
    ->daily()
    ->description('Delete expired organization invitations');

Schedule::command('assets:prune')
    ->daily()
    ->description('Delete orphaned page assets and their unreferenced files');
