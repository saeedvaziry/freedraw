<?php

namespace App\Http\Controllers;

use App\Actions\Auth\FindOrCreateSocialUser;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Auth;
use Laravel\Fortify\Fortify;
use Laravel\Socialite\Facades\Socialite;
use Symfony\Component\HttpFoundation\RedirectResponse as SymfonyRedirectResponse;

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
    public function redirect(string $provider): SymfonyRedirectResponse
    {
        $this->ensureProviderIsSupported($provider);

        return Socialite::driver($provider)->redirect();
    }

    /**
     * Handle the callback from the provider after authentication.
     */
    public function callback(string $provider, FindOrCreateSocialUser $findOrCreateSocialUser): RedirectResponse
    {
        $this->ensureProviderIsSupported($provider);

        $socialUser = Socialite::driver($provider)->user();

        $user = $findOrCreateSocialUser->execute($socialUser);

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
