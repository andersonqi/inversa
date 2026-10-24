<?php

namespace App\Http\Controllers;

use App\Support\Branding;
use Illuminate\Filesystem\FilesystemAdapter;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Logo y color de la empresa (permiso "Configurar parámetros").
 */
class BrandingController extends Controller
{
    public function edit(): Response
    {
        return Inertia::render('settings/branding', [
            'color' => Branding::companyColor(),
            'defaultColor' => Branding::DEFAULT_COLOR,
            'logoUrl' => Branding::logoUrl(),
        ]);
    }

    public function update(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'color' => ['required', 'regex:/^#[0-9a-fA-F]{6}$/'],
            // Sin SVG: podría incluir código que el navegador ejecute.
            'logo' => ['nullable', 'image', 'mimes:png,jpg,jpeg,webp', 'max:2048', 'dimensions:max_width=4000,max_height=4000'],
            'remove_logo' => ['sometimes', 'boolean'],
        ], [
            'color.regex' => 'Elija un color válido.',
            'logo.mimes' => 'El logo debe ser una imagen PNG, JPG o WEBP.',
            'logo.max' => 'El logo no puede pesar más de 2 MB.',
        ], [
            'color' => 'color',
            'logo' => 'logo',
        ]);

        $changes = ['color' => strtolower($data['color'])];
        $previous = Branding::logoPath();
        $logo = $request->file('logo');

        if ($logo instanceof UploadedFile) {
            $path = $logo->store('branding', Branding::DISK);

            if (is_string($path)) {
                $changes['logo_path'] = $path;
                $changes['logo_version'] = time();
            }
        } elseif ($request->boolean('remove_logo')) {
            $changes['logo_path'] = null;
        }

        Branding::save($changes);

        if ($previous !== null && array_key_exists('logo_path', $changes) && $changes['logo_path'] !== $previous) {
            Storage::disk(Branding::DISK)->delete($previous);
        }

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Identidad de la empresa actualizada.']);

        return back();
    }

    /**
     * Logo de la empresa (público: también se muestra en la pantalla de ingreso).
     */
    public function logo(): StreamedResponse
    {
        $path = Branding::logoPath();
        $disk = Storage::disk(Branding::DISK);
        assert($disk instanceof FilesystemAdapter);

        abort_unless($path !== null && $disk->exists($path), 404);

        return $disk->response($path, null, [
            'Cache-Control' => 'public, max-age=31536000, immutable',
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }
}
