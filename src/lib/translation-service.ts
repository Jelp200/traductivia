/* ──────────────────────────────────────────────────────────────
   TraductivIA – Servicio de traducción con Google Gemini
   ──────────────────────────────────────────────────────────────
   Soporta:
     • Imágenes (PNG, JPG, WebP) → OCR + traducción
     • PDF                       → extracción de texto + traducción
     • Word (DOCX/DOC)           → extracción con mammoth + traducción
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

/* ── Helpers ──────────────────────────────────────────────── */

function categorizeFile(mimeType: string): FileCategory {
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType === 'application/pdf') return 'pdf';
    return 'word';
}

function getLangLabel(code: SupportedLanguage): string {
    return LANGUAGES.find((l) => l.code === code)?.label ?? code;
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
 * Traduce un archivo (imagen, PDF o Word) al idioma destino usando Gemini.
 *
 * @param file      - Archivo subido por el usuario.
 * @param targetLang - Código ISO del idioma destino.
 * @returns Resultado con el texto traducido.
 */
export async function translateFile(
    file: File,
    targetLang: SupportedLanguage
): Promise<TranslationResult> {
    const category = categorizeFile(file.type);

    switch (category) {
        case 'image':
            return translateImage(file, targetLang);
        case 'pdf':
            return translatePdf(file, targetLang);
        case 'word':
            return translateWord(file, targetLang);
    }
}
