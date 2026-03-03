import type { APIRoute } from 'astro';
import {
    ACCEPTED_MIME_TYPES,
    LANGUAGES,
    OUTPUT_FORMATS,
    MAX_FILE_SIZE_BYTES,
    type SupportedLanguage,
    type OutputFormat,
    type TranslationResponse,
} from '../../types/translation';
import { translateFile } from '../../lib/translation-service';

/* ── Helpers ──────────────────────────────────────────────── */

function isValidLanguage(value: string): value is SupportedLanguage {
    return LANGUAGES.some((l) => l.code === value);
}

function isValidFormat(value: string): value is OutputFormat {
    return OUTPUT_FORMATS.some((f) => f.value === value);
}

function isAcceptedMime(mime: string): boolean {
    return (ACCEPTED_MIME_TYPES as readonly string[]).includes(mime);
}

function jsonResponse(body: TranslationResponse, status = 200): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });
}

/* ── POST /api/translate ──────────────────────────────────── */

export const POST: APIRoute = async ({ request }) => {
    try {
        const contentType = request.headers.get('content-type') ?? '';
        if (!contentType.includes('multipart/form-data')) {
            return jsonResponse(
                { success: false, message: 'Se esperaba multipart/form-data.' },
                400
            );
        }

        const formData = await request.formData();

        /* ── Extraer campos ──────────────────────────────────── */
        const file = formData.get('file');
        const targetLang = formData.get('targetLang');
        const outputFormat = formData.get('outputFormat');

        if (!(file instanceof File) || !file.name || file.size === 0) {
            return jsonResponse(
                { success: false, message: 'No se recibió un archivo válido.' },
                400
            );
        }

        if (typeof targetLang !== 'string' || !isValidLanguage(targetLang)) {
            return jsonResponse(
                { success: false, message: 'Idioma destino no válido.' },
                400
            );
        }

        if (typeof outputFormat !== 'string' || !isValidFormat(outputFormat)) {
            return jsonResponse(
                { success: false, message: 'Formato de salida no válido.' },
                400
            );
        }

        /* ── Validar tipo MIME ────────────────────────────────── */
        if (!isAcceptedMime(file.type)) {
            return jsonResponse(
                {
                    success: false,
                    message: `Tipo de archivo "${file.type}" no soportado. Se aceptan PDF, Word e imágenes.`,
                },
                400
            );
        }

        /* ── Validar tamaño ──────────────────────────────────── */
        if (file.size > MAX_FILE_SIZE_BYTES) {
            return jsonResponse(
                {
                    success: false,
                    message: `El archivo excede el tamaño máximo de ${MAX_FILE_SIZE_BYTES / (1024 * 1024)} MB.`,
                },
                400
            );
        }

        /* ── Traducir / Extraer ─────────────────────────────── */
        const { translatedText } = await translateFile(file, targetLang);

        /* ── Construir nombre de archivo de salida ───────────── */
        const baseName = file.name.replace(/\.[^.]+$/, '');
        const isExtractOnly = targetLang === 'original';
        const langLabel = isExtractOnly
            ? 'original'
            : (LANGUAGES.find((l) => l.code === targetLang)?.label ?? targetLang);
        const suffix = isExtractOnly ? '_extracted' : `_${targetLang}`;
        const translatedFileName = `${baseName}${suffix}.${outputFormat}`;

        const successMessage = isExtractOnly
            ? `Texto extraído exitosamente de "${file.name}". Formato de salida: ${outputFormat.toUpperCase()}.`
            : `Archivo "${file.name}" traducido exitosamente al ${langLabel}. Formato de salida: ${outputFormat.toUpperCase()}.`;

        return jsonResponse(
            {
                success: true,
                message: successMessage,
                fileName: translatedFileName,
                translatedText,
            },
            200
        );
    } catch (error) {
        console.error('[API /translate] Error:', error);

        let errorMessage = 'Error interno del servidor. Intenta de nuevo más tarde.';

        if (error instanceof Error) {
            if (error.message.includes('GEMINI_API_KEY')) {
                errorMessage = error.message;
            } else if (error.message.includes('demasiado grande')) {
                errorMessage = error.message;
            } else if (
                error.message.includes('fetch failed') ||
                error.message.includes('ETIMEDOUT') ||
                error.message.includes('ECONNRESET') ||
                error.message.includes('timeout')
            ) {
                errorMessage =
                    'La solicitud a la IA tardó demasiado o falló la conexión. ' +
                    'Verifica tu conexión a internet e intenta con un archivo más pequeño.';
            } else if (error.message.includes('404')) {
                errorMessage =
                    'Modelo de IA no disponible. Verifica GEMINI_MODEL en el archivo .env.';
            }
        }

        return jsonResponse(
            { success: false, message: errorMessage },
            500
        );
    }
};
