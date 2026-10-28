<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}" @class(['dark' => ($appearance ?? 'system') == 'dark'])>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <meta name="csrf-token" content="{{ csrf_token() }}">

        <title inertia>{{ config('app.name', 'Laravel') }}</title>

        <link rel="icon" href="/brand/favicon.png" type="image/png">
        <link rel="apple-touch-icon" href="/brand/favicon.png">

        <link rel="preconnect" href="https://fonts.bunny.net">
        <link href="https://fonts.bunny.net/css?family=instrument-sans:400,500,600" rel="stylesheet" />

        @if(config('app.env') !== 'local' || env('VITE_GOOGLE_MAPS_API_KEY'))
            <script src="https://maps.googleapis.com/maps/api/js?key={{ env('VITE_GOOGLE_MAPS_API_KEY') }}&libraries=places,geometry,marker&v=weekly" async defer></script>
        @endif

        @viteReactRefresh
        @vite(['resources/js/app.tsx', "resources/js/pages/{$page['component']}.tsx"])
        @inertiaHead
    </head>
    <body class="font-sans antialiased">
        @inertia
    </body>
</html>
