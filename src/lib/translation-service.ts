/* ──────────────────────────────────────────────────────────────
   TraductivIA – Servicio de traducción con Google Gemini
   ──────────────────────────────────────────────────────────────
   Soporta:
     • Imágenes (PNG, JPG, WebP) → OCR + traducción
     • PDF                       → extracción de texto + traducción
     • Word (DOCX/DOC)           → extracción con mammoth + traducción
     • Modo "original"           → solo extrae texto, sin traducir
   ────────────────────────────────────────────────────────────── */

import { getModel } from './gemini';
import mammoth from 'mammoth';
import {
    LANGUAGES,
    type SupportedLanguage,
} from '../types/translation';

/* ── Tipos internos ───────────────────────────────────────── */

interface TranslationResult {
    translatedText: string;
    detectedSourceLang?: string;
}

type FileCategory = 'image' | 'pdf' | 'word';

/** Tamaño máximo para envío inline a Gemini (10 MB). */
const MAX_INLINE_SIZE_BYTES = 10 * 1024 * 1024;

/* ── Helpers ──────────────────────────────────────────────── */

function categorizeFile(mimeType: string): FileCategory {
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType === 'application/pdf') return 'pdf';
    return 'word';
}

function getLangLabel(code: SupportedLanguage): string {
    return LANGUAGES.find((l) => l.code === code)?.label ?? code;
}

/** Valida que el archivo no exceda el tamaño máximo para inline data. */
function validateFileSize(file: File): void {
    if (file.size > MAX_INLINE_SIZE_BYTES) {
        const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
        throw new Error(
            `El archivo (${sizeMB} MB) es demasiado grande para procesarlo vía OCR. ` +
            `El tamaño máximo es ${MAX_INLINE_SIZE_BYTES / (1024 * 1024)} MB. ` +
            `Intenta con un archivo más pequeño o conviértelo a DOCX para extraer texto sin límite.`
        );
    }
}

/** Convierte un File/Blob a base64 para enviar a Gemini como inline data. */
async function fileToBase64(file: File): Promise<string> {
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (const byte of bytes) {
        binary += String.fromCharCode(byte);
    }
    return btoa(binary);
}

/** Extrae texto plano de un archivo DOCX usando mammoth. */
async function extractTextFromDocx(file: File): Promise<string> {
    // Convertir ArrayBuffer a Node.js Buffer para compatibilidad con mammoth
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
}

/* ── Prompts ──────────────────────────────────────────────── */

function buildTranslationPrompt(targetLang: SupportedLanguage): string {
    const langLabel = getLangLabel(targetLang);
    return [
        `Eres un traductor profesional. Tu tarea es traducir el contenido al ${langLabel} (${targetLang}).`,
        '',
        'Reglas estrictas:',
        '1. Traduce TODO el texto al idioma destino.',
        '2. Mantén el formato original (títulos, párrafos, listas, tablas) lo mejor posible usando Markdown.',
        '3. NO agregues explicaciones, notas ni comentarios propios.',
        '4. Si el texto ya está en el idioma destino, devuélvelo tal cual.',
        '5. Preserva nombres propios, marcas, URLs y código sin traducir.',
        '6. Para términos técnicos sin traducción estándar, mantén el original entre paréntesis.',
        '',
        'Devuelve ÚNICAMENTE el texto traducido, sin encabezados como "Traducción:" ni delimitadores.',
    ].join('\n');
}

function buildOcrTranslationPrompt(targetLang: SupportedLanguage): string {
    const langLabel = getLangLabel(targetLang);
    return [
        `Eres un traductor profesional con capacidad OCR. Tu tarea es:`,
        `1. Extraer TODO el texto visible en la imagen/documento.`,
        `2. Traducirlo al ${langLabel} (${targetLang}).`,
        '',
        'Reglas estrictas:',
        '- Mantén la estructura y formato original usando Markdown.',
        '- NO agregues explicaciones ni comentarios.',
        '- Preserva nombres propios, marcas, URLs y código.',
        '- Si hay tablas, reconstruye con formato Markdown.',
        '- Si no hay texto legible, responde exactamente: "[Sin texto detectado]".',
        '',
        'Devuelve ÚNICAMENTE el texto traducido.',
    ].join('\n');
}

/** Prompt para solo extraer texto (OCR) sin traducir. */
function buildOcrExtractOnlyPrompt(): string {
    return [
        'You are an expert OCR system. Your task is to extract ALL visible text from the provided image or document.',
        '',
        'CRITICAL RULES:',
        '1. Extract EVERY word, number, symbol, and character exactly as it appears.',
        '2. Preserve the ORIGINAL language — do NOT translate anything.',
        '3. Maintain the original structure: headings, paragraphs, lists, tables.',
        '4. Use Markdown formatting to represent the structure.',
        '5. For tables, reconstruct them using Markdown table syntax.',
        '6. Preserve ALL special characters, accents, Cyrillic, Arabic, CJK, etc.',
        '7. Do NOT add any explanations, comments, or notes of your own.',
        '8. Do NOT summarize — extract the COMPLETE text.',
        '9. If a page has headers/footers, include them.',
        '10. If no legible text is found, respond exactly: "[Sin texto detectado]".',
        '',
        'Return ONLY the extracted text, nothing else.',
    ].join('\n');
}

/* ── Funciones de solo extracción (sin Gemini para DOCX) ──── */

/**
 * Extrae texto de un DOCX sin traducir (no requiere Gemini).
 */
async function extractOnlyWord(file: File): Promise<TranslationResult> {
    const extractedText = await extractTextFromDocx(file);

    if (!extractedText.trim()) {
        return { translatedText: '[Documento vacío — no se encontró texto]' };
    }

    return { translatedText: extractedText };
}

/**
 * Extrae texto de una imagen usando OCR de Gemini (sin traducir).
 */
async function extractOnlyImage(file: File): Promise<TranslationResult> {
    validateFileSize(file);
    const model = getModel();
    const base64 = await fileToBase64(file);

    const result = await model.generateContent([
        buildOcrExtractOnlyPrompt(),
        {
            inlineData: {
                data: base64,
                mimeType: file.type,
            },
        },
    ]);

    return { translatedText: result.response.text().trim() };
}

/**
 * Extrae texto de un PDF usando Gemini (sin traducir).
 */
async function extractOnlyPdf(file: File): Promise<TranslationResult> {
    validateFileSize(file);
    const model = getModel();
    const base64 = await fileToBase64(file);

    const result = await model.generateContent([
        buildOcrExtractOnlyPrompt(),
        {
            inlineData: {
                data: base64,
                mimeType: 'application/pdf',
            },
        },
    ]);

    return { translatedText: result.response.text().trim() };
}

/* ── Funciones de traducción por tipo ─────────────────────── */

/**
 * Traduce una imagen (OCR + traducción en un solo paso con Gemini Vision).
 */
async function translateImage(
    file: File,
    targetLang: SupportedLanguage
): Promise<TranslationResult> {
    const model = getModel();
    const base64 = await fileToBase64(file);

    const result = await model.generateContent([
        buildOcrTranslationPrompt(targetLang),
        {
            inlineData: {
                data: base64,
                mimeType: file.type,
            },
        },
    ]);

    const response = result.response;
    const translatedText = response.text().trim();

    return { translatedText };
}

/**
 * Traduce un archivo PDF (envío directo a Gemini como inline data).
 * Gemini 2.0 Flash soporta PDFs de forma nativa.
 */
async function translatePdf(
    file: File,
    targetLang: SupportedLanguage
): Promise<TranslationResult> {
    const model = getModel();
    const base64 = await fileToBase64(file);

    const result = await model.generateContent([
        buildOcrTranslationPrompt(targetLang),
        {
            inlineData: {
                data: base64,
                mimeType: 'application/pdf',
            },
        },
    ]);

    const response = result.response;
    const translatedText = response.text().trim();

    return { translatedText };
}

/**
 * Traduce un documento Word (DOCX).
 * Extrae texto con mammoth y lo envía a Gemini como texto plano.
 */
async function translateWord(
    file: File,
    targetLang: SupportedLanguage
): Promise<TranslationResult> {
    const extractedText = await extractTextFromDocx(file);

    if (!extractedText.trim()) {
        return { translatedText: '[Documento vacío — no se encontró texto para traducir]' };
    }

    const model = getModel();
    const prompt = buildTranslationPrompt(targetLang);

    const result = await model.generateContent([
        prompt,
        '\n\n--- TEXTO A TRADUCIR ---\n\n',
        extractedText,
    ]);

    const response = result.response;
    const translatedText = response.text().trim();

    return { translatedText };
}

/* ── Función principal exportada ──────────────────────────── */

/**
 * Traduce o extrae texto de un archivo (imagen, PDF o Word).
 * Si targetLang es 'original', solo extrae texto sin traducir.
 *
 * @param file      - Archivo subido por el usuario.
 * @param targetLang - Código ISO del idioma destino, o 'original' para solo extraer.
 * @returns Resultado con el texto traducido o extraído.
 */
export async function translateFile(
    file: File,
    targetLang: SupportedLanguage
): Promise<TranslationResult> {
    const category = categorizeFile(file.type);

    // Modo "solo extraer texto" — sin traducción
    if (targetLang === 'original') {
        switch (category) {
            case 'word':
                return extractOnlyWord(file);
            case 'image':
                return extractOnlyImage(file);
            case 'pdf':
                return extractOnlyPdf(file);
        }
    }

    // Modo traducción normal
    switch (category) {
        case 'image':
            return translateImage(file, targetLang);
        case 'pdf':
            return translatePdf(file, targetLang);
        case 'word':
            return translateWord(file, targetLang);
    }
}
