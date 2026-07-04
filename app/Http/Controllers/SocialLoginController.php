<?php

namespace App\Http\Controllers;

use App\Actions\Authentication\FindOrCreateSocialUser;
use App\Services\Authentication\SocialiteService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Routing\Attributes\Controllers\Middleware;
use Illuminate\Support\Facades\Auth;
use Laravel\Fortify\Fortify;
use Symfony\Component\HttpFoundation\RedirectResponse as SymfonyRedirectResponse;

#[Middleware('guest')]
class SocialLoginController extends Controller
{
    /**
     * The social providers supported for authentication.
     *
     * @var list<string>
     */
    protected array $providers = ['github', 'google'];

    /**
     * Redirect the user to the provider for authentication.
     */
    public function redirect(string $provider, SocialiteService $socialite): SymfonyRedirectResponse
    {
        $this->ensureProviderIsSupported($provider);

        return $socialite->redirect($provider);
    }

    /**
     * Handle the callback from the provider after authentication.
     */
    public function callback(string $provider, FindOrCreateSocialUser $findOrCreateSocialUser, SocialiteService $socialite): RedirectResponse
    {
        $this->ensureProviderIsSupported($provider);

        $user = $findOrCreateSocialUser->handle($socialite->user($provider));

        Auth::login($user, remember: true);

        return redirect()->intended(Fortify::redirects('login', '/'));
    }

    /**
     * Abort with a 404 when an unsupported provider is requested.
     */
    protected function ensureProviderIsSupported(string $provider): void
    {
        abort_unless(in_array($provider, $this->providers, true), 404);
    }
}
