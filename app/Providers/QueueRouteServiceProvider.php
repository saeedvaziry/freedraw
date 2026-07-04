<?php

namespace App\Providers;

use Illuminate\Mail\SendQueuedMailable;
use Illuminate\Notifications\SendQueuedNotifications;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\ServiceProvider;

class QueueRouteServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        Queue::route([
            SendQueuedMailable::class => ['redis', 'mail'],
            SendQueuedNotifications::class => ['redis', 'mail'],
        ]);
    }
}
