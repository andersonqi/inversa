<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

/**
 * Datos de un corte (los permisos se validan con el middleware de la ruta).
 */
class StoreCollectionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'client_id' => ['required', 'integer', 'exists:clients,id'],
            'collected_on' => ['required', 'date', 'before_or_equal:today'],
            'notes' => ['nullable', 'string', 'max:2000'],
            // Firma del tendero: data URL PNG generada por el canvas.
            'signature' => ['nullable', 'string', 'max:1500000'],
            'loan_id' => ['nullable', 'integer'],
            'loan_deduction' => ['nullable', 'numeric', 'min:0'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.machine_id' => ['required', 'integer', 'distinct'],
            'items.*.current_in' => ['required', 'integer', 'min:0'],
            'items.*.current_out' => ['required', 'integer', 'min:0'],
            'items.*.forced' => ['sometimes', 'boolean'],
            'items.*.cash_counted' => ['nullable', 'numeric', 'min:0'],
            'items.*.notes' => ['nullable', 'string', 'max:1000'],
            'items.*.photo' => ['nullable', 'image', 'max:8192'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'items.*.photo.image' => 'La foto del contador debe ser una imagen.',
            'items.*.photo.max' => 'La foto del contador no puede pesar más de 8 MB.',
        ];
    }
}
