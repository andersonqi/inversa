<?php

namespace App\Services;

use App\Models\CollectionItem;
use App\Support\PhotoRetention;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Filesystem\FilesystemAdapter;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Fotos de clientes, negocios y máquinas (disco privado) y depuración de las fotos de
 * contadores de los cortes según el plazo configurado (PhotoRetention).
 */
class PhotoStorage
{
    /**
     * Mismo disco privado que las fotos de contadores y las firmas.
     */
    public const DISK = CollectionService::DISK;

    /**
     * Reglas de validación de una foto subida desde un formulario.
     *
     * @return list<string>
     */
    public static function rules(): array
    {
        return ['nullable', 'image', 'mimes:jpg,jpeg,png,webp', 'max:8192'];
    }

    /**
     * Mensajes de validación para los campos de foto indicados.
     *
     * @param  list<string>  $inputs
     * @return array<string, string>
     */
    public static function messages(array $inputs): array
    {
        $messages = [];

        foreach ($inputs as $input) {
            $messages["{$input}.image"] = 'La foto debe ser una imagen.';
            $messages["{$input}.mimes"] = 'La foto debe ser JPG, PNG o WEBP.';
            $messages["{$input}.max"] = 'La foto no puede pesar más de 8 MB.';
            $messages["{$input}.uploaded"] = 'No se pudo subir la foto; intente de nuevo.';
        }

        return $messages;
    }

    /**
     * Aplica las fotos del formulario al modelo: guarda las nuevas, quita las marcadas
     * con "remove_{campo}" y borra del disco los archivos reemplazados.
     *
     * @param  array<string, string>  $fields  columna => campo del formulario
     */
    public function sync(Model $model, Request $request, array $fields, string $directory): void
    {
        $obsolete = [];

        foreach ($fields as $column => $input) {
            $previous = $model->getAttribute($column);
            $file = $request->file($input);

            if ($file instanceof UploadedFile) {
                $path = $file->store($directory, self::DISK);

                if (! is_string($path)) {
                    continue;
                }

                $model->setAttribute($column, $path);
            } elseif ($request->boolean("remove_{$input}")) {
                $model->setAttribute($column, null);
            } else {
                continue;
            }

            if (is_string($previous) && $previous !== '') {
                $obsolete[] = $previous;
            }
        }

        if ($model->isDirty()) {
            $model->save();
        }

        if ($obsolete !== []) {
            Storage::disk(self::DISK)->delete($obsolete);
        }
    }

    /**
     * Borra todas las fotos guardadas en la carpeta de un registro eliminado.
     */
    public function deleteDirectory(string $directory): void
    {
        Storage::disk(self::DISK)->deleteDirectory($directory);
    }

    /**
     * Respuesta con la imagen. La URL lleva la versión del archivo, así que el navegador
     * puede guardarla en caché sin mostrar una foto anterior.
     */
    public function response(?string $path): StreamedResponse
    {
        $disk = Storage::disk(self::DISK);
        assert($disk instanceof FilesystemAdapter);

        abort_unless(is_string($path) && $path !== '' && $disk->exists($path), 404);

        return $disk->response($path, null, [
            'Cache-Control' => 'private, max-age=2592000',
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }

    /**
     * Elimina las fotos de contadores de los cortes con más días que el plazo configurado.
     * Devuelve cuántas fotos se eliminaron.
     */
    public function pruneCounterPhotos(?int $days = null): int
    {
        $days ??= PhotoRetention::current()->days;
        $cutoff = now()->subDays($days)->toDateString();
        $disk = Storage::disk(self::DISK);
        $pruned = 0;

        CollectionItem::query()
            ->whereNotNull('photo_path')
            ->whereHas('collection', fn (Builder $q) => $q->where('collected_on', '<', $cutoff))
            ->select(['id', 'photo_path'])
            ->chunkById(200, function ($items) use ($disk, &$pruned) {
                $paths = $items->pluck('photo_path')->filter(fn ($path) => is_string($path) && $path !== '')->values()->all();
                $disk->delete($paths);

                CollectionItem::query()->whereKey($items->pluck('id')->all())->update(['photo_path' => null]);

                $pruned += $items->count();
            });

        return $pruned;
    }
}
