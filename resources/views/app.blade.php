@php
    // Color de la interfaz (validado como #rrggbb en App\Support\Branding).
    $theme = $page['props']['theme'] ?? null;
    $brand = is_array($theme) && preg_match('/^#[0-9a-fA-F]{6}$/', $theme['color'] ?? '') ? $theme['color'] : '#0e5a4a';
    $brandContrast = is_array($theme) && preg_match('/^#[0-9a-fA-F]{6}$/', $theme['contrast'] ?? '') ? $theme['contrast'] : '#ffffff';
@endphp
<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}" @class(['dark' => ($appearance ?? 'system') == 'dark']) style="--brand: {{ $brand }}; --brand-contrast: {{ $brandContrast }};">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">

        {{-- Inline script to detect system dark mode preference and apply it immediately --}}
        <script>
            (function() {
                const appearance = '{{ $appearance ?? "system" }}';

                if (appearance === 'system') {
                    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

                    if (prefersDark) {
                        document.documentElement.classList.add('dark');
                    }
                }
            })();
        </script>

        {{-- Fondo inicial con el color de la marca (antes de cargar los estilos) --}}
        <style>
            html {
                background-color: color-mix(in oklab, var(--brand) 40%, #000);
            }
        </style>

        <link rel="icon" href="/favicon.ico" sizes="any">
        <link rel="icon" href="/favicon.svg" type="image/svg+xml">
        <link rel="apple-touch-icon" href="/apple-touch-icon.png">
        <link rel="manifest" href="/manifest.webmanifest">
        <meta name="theme-color" content="{{ $brand }}">

        @fonts

        @viteReactRefresh
        @vite(['resources/css/app.css', 'resources/js/app.tsx', "resources/js/pages/{$page['component']}.tsx"])
        <x-inertia::head>
            <title>{{ config('app.name', 'Laravel') }}</title>
        </x-inertia::head>
    </head>
    <body class="font-sans antialiased">
        <x-inertia::app />
    </body>
</html>
