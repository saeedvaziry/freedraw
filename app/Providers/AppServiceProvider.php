<?php

namespace App\Providers;

use App\Models\User;
use Carbon\CarbonImmutable;
use Dedoc\Scramble\Scramble;
use Illuminate\Routing\Route;
use Illuminate\Support\Facades\Date;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\ServiceProvider;
use Illuminate\Validation\Rules\Password;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        $this->configureDefaults();
    }

    /**
     * Configure default behaviors for production-ready applications.
     */
    protected function configureDefaults(): void
    {
        Date::use(CarbonImmutable::class);

        DB::prohibitDestructiveCommands(
            app()->isProduction(),
        );

        Password::defaults(fn (): ?Password => app()->isProduction()
            ? Password::min(12)
                ->mixedCase()
                ->letters()
                ->numbers()
                ->symbols()
                ->uncompromised()
            : null,
        );

        $this->configureApiDocs();
    }

    private function configureApiDocs(): void
    {
        Gate::define('viewApiDocs', function (?User $user = null): bool {
            if (app()->isLocal()) {
                return true;
            }

            $emails = config('scramble.access_emails', []);

            return $user !== null && in_array($user->email, $emails, true);
        });

        if (! class_exists(Scramble::class)) {
            return;
        }

        Scramble::configure()
            ->routes(fn (Route $route): bool => in_array($route->getName(), [
                'pages.store',
                'pages.update',
                'pages.destroy',
                'pages.share',
            ], true));
    }
}
