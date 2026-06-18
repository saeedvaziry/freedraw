@php
    $appName = config('app.name');
@endphp

<x-mail::message>
# Verify your email address

Hi {{ $name }},

Welcome to {{ $appName }}! Please confirm your email address to activate your account and start drawing.

<x-mail::button :url="$verificationUrl" color="primary">
Verify email address
</x-mail::button>

This link will expire shortly for your security. If you did not create a {{ $appName }} account, you can safely ignore this email.

Thanks,<br>
The {{ $appName }} team

<x-slot:subcopy>
If you're having trouble clicking the "Verify email address" button, copy and paste the URL below into your web browser:

<span class="break-all">[{{ $verificationUrl }}]({{ $verificationUrl }})</span>
</x-slot:subcopy>
</x-mail::message>
