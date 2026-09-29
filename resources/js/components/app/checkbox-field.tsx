import { useState } from 'react';
import { Checkbox } from '@/components/ui/checkbox';

/** Checkbox que siempre envía "1" o "0" para que el backend reciba el valor desmarcado. */
export function CheckboxField({
    name,
    label,
    defaultChecked = false,
}: {
    name: string;
    label: string;
    defaultChecked?: boolean;
}) {
    const [checked, setChecked] = useState(defaultChecked);

    return (
        <label className="flex items-center gap-2 text-sm">
            <Checkbox
                checked={checked}
                onCheckedChange={(value) => setChecked(value === true)}
            />
            <input type="hidden" name={name} value={checked ? '1' : '0'} />
            {label}
        </label>
    );
}
