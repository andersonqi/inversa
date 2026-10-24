<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Resend, Postmark, AWS, and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    // Tipo de cambio quetzal / dólar (Banguat, con fuente de respaldo).
    'exchange_rate' => [
        // Actualizar en segundo plano al navegar cuando el dato está vencido.
        'auto_refresh' => (bool) env('EXCHANGE_RATE_AUTO_REFRESH', true),
        'max_age_minutes' => (int) env('EXCHANGE_RATE_MAX_AGE_MINUTES', 60),
    ],

    // App de Android (APK / Play Store) que abre el sistema a pantalla completa (TWA).
    // Se publica en /.well-known/assetlinks.json para que Android confíe en el dominio.
    'android' => [
        'package' => env('ANDROID_PACKAGE_NAME'),
        // Huellas SHA-256 del certificado de firma, separadas por coma.
        'sha256_fingerprints' => array_values(array_filter(array_map(
            'trim',
            explode(',', (string) env('ANDROID_SHA256_FINGERPRINTS', '')),
        ))),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

];
