/* ──────────────────────────────────────────────────────────────
   TraductivIA – Cliente de Google Gemini
   ────────────────────────────────────────────────────────────── */

import { GoogleGenerativeAI } from '@google/generative-ai';

/** Modelo por defecto — configurable vía GEMINI_MODEL en .env */
const DEFAULT_MODEL = 'gemini-3.1-pro-preview';

let _instance: GoogleGenerativeAI | null = null;

/**
 * Obtiene la instancia singleton de GoogleGenerativeAI.
 * Lanza un error claro si la API key no está configurada.
 */
function getClient(): GoogleGenerativeAI {
    if (_instance) return _instance;

    const apiKey = import.meta.env.GEMINI_API_KEY as string | undefined;

    if (!apiKey || apiKey === 'tu_api_key_aqui') {
        throw new Error(
            '[Gemini] GEMINI_API_KEY no configurada. ' +
            'Copia .env.example a .env y agrega tu key de https://aistudio.google.com/apikey'
        );
    }

    _instance = new GoogleGenerativeAI(apiKey);
    return _instance;
}

/**
 * Obtiene una instancia del modelo generativo configurada para traducción.
 * Usa GEMINI_MODEL del .env si está definido, si no usa DEFAULT_MODEL.
 */
/** Timeout para requests a Gemini (5 minutos — PDFs con OCR pueden tardar). */
const REQUEST_TIMEOUT_MS = 300_000;

export function getModel(modelName?: string) {
    const model = modelName
        ?? (import.meta.env.GEMINI_MODEL as string | undefined)
        ?? DEFAULT_MODEL;

    return getClient().getGenerativeModel(
        {
            model,
            generationConfig: {
                temperature: 0.2, // Baja creatividad → traducciones más fieles
                maxOutputTokens: 8192,
            },
        },
        { timeout: REQUEST_TIMEOUT_MS }
    );
}
