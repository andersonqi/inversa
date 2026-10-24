/**
 * Reduce una foto (máx. 1600 px, JPEG) para subirla rápido desde el teléfono y no
 * llenar el servidor. Si el navegador no puede procesarla, devuelve el archivo original.
 */
export async function compressImage(
    file: File,
    fileName = 'foto.jpg',
): Promise<File> {
    try {
        const bitmap = await createImageBitmap(file);
        const scale = Math.min(
            1,
            1600 / Math.max(bitmap.width, bitmap.height),
        );
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(bitmap.width * scale);
        canvas.height = Math.round(bitmap.height * scale);
        canvas
            .getContext('2d')
            ?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

        const blob = await new Promise<Blob | null>((resolve) =>
            canvas.toBlob(resolve, 'image/jpeg', 0.75),
        );

        return blob
            ? new File([blob], fileName, { type: 'image/jpeg' })
            : file;
    } catch {
        return file;
    }
}

/**
 * URL de una foto privada con la versión del archivo, para que el navegador no muestre
 * una foto anterior después de reemplazarla.
 */
export function photoUrl(url: string, path: string | null): string | null {
    if (!path) {
        return null;
    }

    const version = path.split('/').pop() ?? '';

    return `${url}${url.includes('?') ? '&' : '?'}v=${encodeURIComponent(version)}`;
}
