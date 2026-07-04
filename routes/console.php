<?php

use Illuminate\Support\Facades\Schedule;

Schedule::command('organizations:prune-expired-invitations')
    ->daily()
    ->description('Delete expired organization invitations');
