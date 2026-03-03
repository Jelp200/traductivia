/* ──────────────────────────────────────────────────────────────
   TraductivIA – Tipos compartidos para traducción de documentos
   ────────────────────────────────────────────────────────────── */

/** Códigos ISO 639‑1 de los idiomas soportados + 'original' para solo extraer texto.
 *  Para agregar un nuevo idioma, añade el código aquí y un objeto en LANGUAGES. */
export type SupportedLanguage = 'es' | 'en' | 'ru' | 'uk' | 'original';

/** Formatos de archivo de salida disponibles. */
export type OutputFormat = 'pdf' | 'docx';

/** Tipos MIME aceptados para la subida de archivos. */
export const ACCEPTED_MIME_TYPES = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
    'image/png',
    'image/jpeg',
    'image/webp',
] as const;

export type AcceptedMimeType = (typeof ACCEPTED_MIME_TYPES)[number];

/** Extensiones de archivo permitidas (para el atributo `accept` del input). */
export const ACCEPTED_EXTENSIONS = '.pdf,.doc,.docx,.png,.jpg,.jpeg,.webp';

/** Tamaño máximo de archivo en bytes (10 MB). */
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

/* ── Opciones para selectores ─────────────────────────────── */

export interface LanguageOption {
    code: SupportedLanguage;
    label: string;
}

/** Lista de idiomas disponibles. Extiende este array para añadir más idiomas. */
export const LANGUAGES: readonly LanguageOption[] = [
    { code: 'original', label: 'Solo extraer texto (sin traducción)' },
    { code: 'en', label: 'Inglés' },
    { code: 'es', label: 'Español' },
    { code: 'ru', label: 'Ruso' },
    { code: 'uk', label: 'Ucraniano' },
] as const;

export interface FormatOption {
    value: OutputFormat;
    label: string;
}

export const OUTPUT_FORMATS: readonly FormatOption[] = [
    { value: 'pdf', label: 'PDF' },
    { value: 'docx', label: 'Word (DOCX)' },
] as const;

/* ── Request / Response ───────────────────────────────────── */

export interface TranslationRequest {
    file: File;
    targetLang: SupportedLanguage;
    outputFormat: OutputFormat;
}

export interface TranslationResponse {
    success: boolean;
    message: string;
    fileName?: string;
    /** Texto traducido devuelto por la IA. */
    translatedText?: string;
}
