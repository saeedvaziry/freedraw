@php
    $appName = config('app.name');
@endphp

<x-mail::message>
# Reset your password

Hi {{ $name }},

We received a request to reset the password for your {{ $appName }} account. Click the button below to choose a new password.

<x-mail::button :url="$resetUrl" color="primary">
Reset password
</x-mail::button>

This password reset link will expire in {{ $expiresInMinutes }} minutes. If you did not request a password reset, no further action is required — your password will stay the same.

Thanks,<br>
The {{ $appName }} team

<x-slot:subcopy>
If you're having trouble clicking the "Reset password" button, copy and paste the URL below into your web browser:

<span class="break-all">[{{ $resetUrl }}]({{ $resetUrl }})</span>
</x-slot:subcopy>
</x-mail::message>
