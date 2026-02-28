import type { APIRoute } from 'astro';
import { generateFile } from '../../lib/file-generator';
import {
    OUTPUT_FORMATS,
    type OutputFormat,
} from '../../types/translation';

/* ── Helpers ──────────────────────────────────────────────── */

function isValidFormat(value: string): value is OutputFormat {
    return OUTPUT_FORMATS.some((f) => f.value === value);
}

/* ── POST /api/download ───────────────────────────────────── */

export const POST: APIRoute = async ({ request }) => {
    try {
        const body = await request.json() as {
            translatedText?: string;
            outputFormat?: string;
            fileName?: string;
        };

        const { translatedText, outputFormat, fileName } = body;

        /* ── Validaciones ──────────────────────────────────────── */
        if (!translatedText || typeof translatedText !== 'string' || !translatedText.trim()) {
            return new Response(
                JSON.stringify({ success: false, message: 'No se recibió texto para generar el archivo.' }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
        }

        if (!outputFormat || typeof outputFormat !== 'string' || !isValidFormat(outputFormat)) {
            return new Response(
                JSON.stringify({ success: false, message: 'Formato de salida no válido.' }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
        }

        const baseName = (typeof fileName === 'string' && fileName.trim())
            ? fileName.replace(/\.[^.]+$/, '')
            : 'traduccion';

        /* ── Generar archivo ──────────────────────────────────── */
        const { buffer, mimeType, extension } = await generateFile(
            translatedText,
            outputFormat,
            baseName
        );

        const outputFileName = `${baseName}.${extension}`;

        return new Response(buffer, {
            status: 200,
            headers: {
                'Content-Type': mimeType,
                'Content-Disposition': `attachment; filename="${encodeURIComponent(outputFileName)}"`,
                'Content-Length': buffer.byteLength.toString(),
            },
        });
    } catch (error) {
        console.error('[API /download] Error:', error);

        return new Response(
            JSON.stringify({ success: false, message: 'Error al generar el archivo. Intenta de nuevo.' }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
    }
};
