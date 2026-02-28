/* ──────────────────────────────────────────────────────────────
   TraductivIA – Cliente de Google Gemini
   ────────────────────────────────────────────────────────────── */

import { GoogleGenerativeAI } from '@google/generative-ai';

/** Modelo por defecto — Gemini 3.1 Pro Preview (actual, multimodal, recomendado). */
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
 */
export function getModel(modelName = DEFAULT_MODEL) {
    return getClient().getGenerativeModel({
        model: modelName,
        generationConfig: {
            temperature: 0.2, // Baja creatividad → traducciones más fieles
            maxOutputTokens: 8192,
        },
    });
}
