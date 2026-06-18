@props(['url'])
<tr>
<td class="header">
<a href="{{ $url }}" style="display: inline-block; text-decoration: none;">
<img src="{{ asset('favicon-512.png') }}" class="logo" alt="{{ config('app.name') }}">
<span class="brand-name">{{ $slot }}</span>
</a>
</td>
</tr>
