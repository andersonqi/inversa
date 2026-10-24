<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;

/**
 * Corte registrado sin conexión: además de los datos del corte trae el identificador del
 * teléfono, los contadores que el cobrador tenía como "anteriores" y, si hubo conflicto,
 * la decisión tomada.
 */
class SyncCollectionRequest extends StoreCollectionRequest
{
    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            ...parent::rules(),
            'offline_id' => ['required', 'uuid'],
            'items.*.base_in' => ['required', 'integer', 'min:0'],
            'items.*.base_out' => ['required', 'integer', 'min:0'],
            // replace = anular los cortes registrados en conflicto y guardar este.
            'resolution' => ['nullable', 'in:replace'],
            'replace_ids' => ['nullable', 'array'],
            'replace_ids.*' => ['integer'],
        ];
    }
}
