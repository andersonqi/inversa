<?php

namespace Tests\Feature;

use App\Support\Branding;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\Concerns\BuildsOperation;
use Tests\TestCase;

class BrandingTest extends TestCase
{
    use BuildsOperation, RefreshDatabase;

    private const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

    protected function setUp(): void
    {
        parent::setUp();

        $this->buildOperation();
    }

    public function test_default_theme_is_shared_with_every_page(): void
    {
        $this->get(route('login'))
            ->assertInertia(fn (Assert $page) => $page
                ->where('theme.color', Branding::DEFAULT_COLOR)
                ->where('theme.contrast', '#ffffff')
                ->where('theme.logo_url', null));
    }

    public function test_admin_sets_company_color_and_logo(): void
    {
        Storage::fake(Branding::DISK);

        $this->actingAs($this->admin)
            ->from(route('branding.edit'))
            ->post(route('branding.update'), [
                'color' => '#1D4ED8',
                'logo' => UploadedFile::fake()->createWithContent('logo.png', (string) base64_decode(self::PNG)),
            ])
            ->assertSessionHasNoErrors()
            ->assertRedirect(route('branding.edit'))
            ->assertInertiaFlash('toast.type', 'success');

        $this->assertSame('#1d4ed8', Branding::companyColor());
        $path = Branding::logoPath();
        $this->assertNotNull($path);
        Storage::disk(Branding::DISK)->assertExists($path);

        // El logo se ve sin iniciar sesión (pantalla de ingreso).
        $this->get((string) Branding::logoUrl())->assertOk();

        $this->actingAs($this->collector)->get(route('dashboard'))
            ->assertInertia(fn (Assert $page) => $page
                ->where('theme.color', '#1d4ed8')
                ->where('theme.company_color', '#1d4ed8')
                ->where('theme.logo_url', Branding::logoUrl()));

        // Quitar el logo borra el archivo.
        $this->actingAs($this->admin)
            ->post(route('branding.update'), ['color' => '#1d4ed8', 'remove_logo' => '1'])
            ->assertSessionHasNoErrors();

        $this->assertNull(Branding::logoPath());
        Storage::disk(Branding::DISK)->assertMissing($path);
    }

    public function test_branding_validates_color_and_logo_type(): void
    {
        $this->actingAs($this->admin)
            ->post(route('branding.update'), [
                'color' => 'red',
                'logo' => UploadedFile::fake()->createWithContent('logo.svg', '<svg xmlns="http://www.w3.org/2000/svg"></svg>'),
            ])
            ->assertSessionHasErrors(['color', 'logo']);
    }

    public function test_only_users_with_permission_manage_branding(): void
    {
        foreach ([$this->supervisor, $this->collector] as $user) {
            $this->actingAs($user)->get(route('branding.edit'))->assertForbidden();
            $this->actingAs($user)->post(route('branding.update'), ['color' => '#000000'])->assertForbidden();
        }

        $this->actingAs($this->admin)->get(route('branding.edit'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->component('settings/branding'));
    }

    public function test_each_user_can_choose_a_personal_color(): void
    {
        $this->actingAs($this->collector)
            ->patch(route('appearance.color'), ['accent_color' => '#FACC15'])
            ->assertSessionHasNoErrors();

        $this->assertSame('#facc15', $this->collector->fresh()?->accent_color);

        // Color claro: el texto sobre él pasa a ser oscuro.
        $this->actingAs($this->collector)->get(route('dashboard'))
            ->assertInertia(fn (Assert $page) => $page
                ->where('theme.color', '#facc15')
                ->where('theme.contrast', '#111827')
                ->where('theme.company_color', Branding::DEFAULT_COLOR));

        // Los demás siguen con el color de la empresa.
        $this->actingAs($this->supervisor)->get(route('dashboard'))
            ->assertInertia(fn (Assert $page) => $page->where('theme.color', Branding::DEFAULT_COLOR));

        $this->actingAs($this->collector)
            ->patch(route('appearance.color'), ['accent_color' => null])
            ->assertSessionHasNoErrors();

        $this->assertNull($this->collector->fresh()?->accent_color);

        $this->actingAs($this->collector)
            ->patch(route('appearance.color'), ['accent_color' => 'url(javascript:alert(1))'])
            ->assertSessionHasErrors('accent_color');
    }

    public function test_contrast_follows_luminance(): void
    {
        $this->assertSame('#ffffff', Branding::contrast('#0e5a4a'));
        $this->assertSame('#111827', Branding::contrast('#ffffff'));
        $this->assertSame('#111827', Branding::contrast('#facc15'));
    }
}
