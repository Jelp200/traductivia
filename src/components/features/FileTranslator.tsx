import { useState, useRef, useCallback } from 'react';
import type { DragEvent, ChangeEvent, FormEvent } from 'react';
import {
    LANGUAGES,
    OUTPUT_FORMATS,
    ACCEPTED_EXTENSIONS,
    ACCEPTED_MIME_TYPES,
    MAX_FILE_SIZE_BYTES,
    type SupportedLanguage,
    type OutputFormat,
    type TranslationResponse,
} from '../../types/translation';

/* ── Helpers ──────────────────────────────────────────────── */

function isAcceptedType(file: File): boolean {
    return (ACCEPTED_MIME_TYPES as readonly string[]).includes(file.type);
}

function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/* ── Component ────────────────────────────────────────────── */

export default function FileTranslator() {
    /* State */
    const [file, setFile] = useState<File | null>(null);
    const [targetLang, setTargetLang] = useState<SupportedLanguage>('original');
    const [outputFormat, setOutputFormat] = useState<OutputFormat>('pdf');
    const [isLoading, setIsLoading] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);
    const [result, setResult] = useState<TranslationResponse | null>(null);
    const [dragActive, setDragActive] = useState(false);
    const [validationError, setValidationError] = useState<string | null>(null);

    const inputRef = useRef<HTMLInputElement>(null);

    /* ── File validation ─────────────────────────────────────── */

    const validateAndSetFile = useCallback((incoming: File | null) => {
        setResult(null);
        setValidationError(null);

        if (!incoming) {
            setFile(null);
            return;
        }

        if (!isAcceptedType(incoming)) {
            setValidationError(
                'Tipo de archivo no soportado. Solo se aceptan PDF, Word (.doc/.docx) e imágenes (PNG, JPG, WebP).'
            );
            return;
        }

        if (incoming.size > MAX_FILE_SIZE_BYTES) {
            setValidationError(
                `El archivo excede el tamaño máximo permitido (${formatBytes(MAX_FILE_SIZE_BYTES)}).`
            );
            return;
        }

        setFile(incoming);
    }, []);

    /* ── Drag & Drop handlers ────────────────────────────────── */

    const handleDrag = useCallback((e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === 'dragenter' || e.type === 'dragover') {
            setDragActive(true);
        } else if (e.type === 'dragleave') {
            setDragActive(false);
        }
    }, []);

    const handleDrop = useCallback(
        (e: DragEvent<HTMLDivElement>) => {
            e.preventDefault();
            e.stopPropagation();
            setDragActive(false);

            const droppedFile = e.dataTransfer.files?.[0] ?? null;
            validateAndSetFile(droppedFile);
        },
        [validateAndSetFile]
    );

    const handleFileInput = useCallback(
        (e: ChangeEvent<HTMLInputElement>) => {
            const selected = e.target.files?.[0] ?? null;
            validateAndSetFile(selected);
        },
        [validateAndSetFile]
    );

    const removeFile = useCallback(() => {
        setFile(null);
        setResult(null);
        setValidationError(null);
        if (inputRef.current) inputRef.current.value = '';
    }, []);

    /* ── Submit ──────────────────────────────────────────────── */

    const handleSubmit = useCallback(
        async (e: FormEvent) => {
            e.preventDefault();
            if (!file || isLoading) return;

            setIsLoading(true);
            setResult(null);
            setValidationError(null);

            try {
                const formData = new FormData();
                formData.append('file', file);
                formData.append('targetLang', targetLang);
                formData.append('outputFormat', outputFormat);

                const res = await fetch('/api/translate', {
                    method: 'POST',
                    body: formData,
                });

                const data: TranslationResponse = await res.json();
                setResult(data);
            } catch {
                setResult({
                    success: false,
                    message: 'Error de conexión. Intenta de nuevo más tarde.',
                });
            } finally {
                setIsLoading(false);
            }
        },
        [file, targetLang, outputFormat, isLoading]
    );

    /* ── Download translated file ────────────────────────────── */

    const handleDownload = useCallback(async () => {
        if (!result?.translatedText || !result.fileName || isDownloading) return;

        setIsDownloading(true);

        try {
            const res = await fetch('/api/download', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    translatedText: result.translatedText,
                    outputFormat,
                    fileName: result.fileName,
                }),
            });

            if (!res.ok) {
                const errorData = await res.json().catch(() => null);
                throw new Error(errorData?.message ?? 'Error al generar el archivo');
            }

            // Create blob and trigger download
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = result.fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (err) {
            console.error('Download error:', err);
        } finally {
            setIsDownloading(false);
        }
    }, [result, outputFormat, isDownloading]);

    /* ── Render ──────────────────────────────────────────────── */

    const canSubmit = file !== null && !isLoading;

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            {/* ── Drop zone ───────────────────────────────────────── */}
            <div
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                onClick={() => inputRef.current?.click()}
                className={`
          relative flex flex-col items-center justify-center gap-3
          rounded-xl border-2 border-dashed p-8 cursor-pointer
          transition-colors duration-200
          ${dragActive
                        ? 'border-indigo-500 bg-indigo-50'
                        : 'border-gray-300 bg-gray-50 hover:border-indigo-400 hover:bg-indigo-50/50'
                    }
        `}
            >
                {/* Upload icon */}
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className={`h-10 w-10 transition-colors ${dragActive ? 'text-indigo-500' : 'text-gray-400'}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 16.5V9.75m0 0 3 3m-3-3-3 3M6.75 19.5a4.5 4.5 0 0 1-1.41-8.775 5.25 5.25 0 0 1 10.233-2.33 3 3 0 0 1 3.758 3.848A3.752 3.752 0 0 1 18 19.5H6.75Z"
                    />
                </svg>

                <div className="text-center">
                    <p className="text-sm font-medium text-gray-700">
                        {dragActive
                            ? 'Suelta el archivo aquí'
                            : 'Arrastra y suelta tu archivo aquí'}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                        o <span className="text-indigo-600 font-medium">haz clic para seleccionar</span>
                    </p>
                    <p className="mt-2 text-xs text-gray-400">
                        PDF, Word o Imagen — Máx. {formatBytes(MAX_FILE_SIZE_BYTES)}
                    </p>
                </div>

                <input
                    ref={inputRef}
                    type="file"
                    accept={ACCEPTED_EXTENSIONS}
                    onChange={handleFileInput}
                    className="hidden"
                />
            </div>

            {/* ── Validation error ────────────────────────────────── */}
            {validationError && (
                <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM8.28 7.22a.75.75 0 0 0-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 1 0 1.06 1.06L10 11.06l1.72 1.72a.75.75 0 1 0 1.06-1.06L11.06 10l1.72-1.72a.75.75 0 0 0-1.06-1.06L10 8.94 8.28 7.22Z" clipRule="evenodd" />
                    </svg>
                    {validationError}
                </div>
            )}

            {/* ── Selected file badge ─────────────────────────────── */}
            {file && (
                <div className="flex items-center justify-between rounded-lg bg-indigo-50 px-4 py-3">
                    <div className="flex items-center gap-3 min-w-0">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 shrink-0 text-indigo-600" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M3 3.5A1.5 1.5 0 0 1 4.5 2h6.879a1.5 1.5 0 0 1 1.06.44l4.122 4.12A1.5 1.5 0 0 1 17 7.622V16.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 3 16.5v-13Z" />
                        </svg>
                        <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-indigo-900">{file.name}</p>
                            <p className="text-xs text-indigo-600">{formatBytes(file.size)}</p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={removeFile}
                        className="ml-2 rounded-full p-1 text-indigo-400 hover:bg-indigo-100 hover:text-indigo-700 transition-colors"
                        aria-label="Eliminar archivo"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM8.28 7.22a.75.75 0 0 0-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 1 0 1.06 1.06L10 11.06l1.72 1.72a.75.75 0 1 0 1.06-1.06L11.06 10l1.72-1.72a.75.75 0 0 0-1.06-1.06L10 8.94 8.28 7.22Z" clipRule="evenodd" />
                        </svg>
                    </button>
                </div>
            )}

            {/* ── Options row ─────────────────────────────────────── */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {/* Target language */}
                <div>
                    <label htmlFor="targetLang" className="mb-1.5 block text-sm font-medium text-gray-700">
                        Acción / Idioma destino
                    </label>
                    <select
                        id="targetLang"
                        value={targetLang}
                        onChange={(e) => setTargetLang(e.target.value as SupportedLanguage)}
                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 shadow-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none transition"
                    >
                        {LANGUAGES.map((lang) => (
                            <option key={lang.code} value={lang.code}>
                                {lang.label}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Output format */}
                <div>
                    <label htmlFor="outputFormat" className="mb-1.5 block text-sm font-medium text-gray-700">
                        Formato de salida
                    </label>
                    <select
                        id="outputFormat"
                        value={outputFormat}
                        onChange={(e) => setOutputFormat(e.target.value as OutputFormat)}
                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 shadow-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none transition"
                    >
                        {OUTPUT_FORMATS.map((fmt) => (
                            <option key={fmt.value} value={fmt.value}>
                                {fmt.label}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {/* ── Submit button ───────────────────────────────────── */}
            <button
                type="submit"
                disabled={!canSubmit}
                className={`
          flex w-full items-center justify-center gap-2 rounded-xl px-6 py-3
          text-sm font-semibold text-white shadow-sm transition-all duration-200
          ${canSubmit
                        ? 'bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] cursor-pointer'
                        : 'bg-indigo-300 cursor-not-allowed'
                    }
        `}
            >
                {isLoading ? (
                    <>
                        {/* Spinner */}
                        <svg className="h-5 w-5 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4Zm2 5.291A7.962 7.962 0 0 1 4 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647Z" />
                        </svg>
                        {targetLang === 'original' ? 'Extrayendo texto…' : 'Traduciendo…'}
                    </>
                ) : (
                    <>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M7.75 2.75a.75.75 0 0 0-1.5 0v1.258a32.987 32.987 0 0 0-3.599.278.75.75 0 1 0 .198 1.487A31.545 31.545 0 0 1 8.7 5.545 19.381 19.381 0 0 1 7.257 9.04a19.418 19.418 0 0 1-1.416-2.13.75.75 0 0 0-1.32.716 20.898 20.898 0 0 0 1.707 2.644 19.39 19.39 0 0 1-2.768 2.058.75.75 0 0 0 .788 1.277 20.857 20.857 0 0 0 3.063-2.318A20.876 20.876 0 0 0 10.4 13.32a.75.75 0 1 0-.94-1.166 19.39 19.39 0 0 1-2.457 1.725 19.394 19.394 0 0 0 1.544-3.048c.135.09.272.178.411.264a.75.75 0 1 0 .788-1.277 17.9 17.9 0 0 1-.417-.27A20.89 20.89 0 0 0 10.92 5.7a.75.75 0 0 0-1.395-.551A19.357 19.357 0 0 1 8.25 8.518V2.75ZM14.75 7.5a.75.75 0 0 0-1.41.355l.001.01 1 4.5a.75.75 0 0 0 .568.546l.007.001.009.002 2.075.415a.75.75 0 0 0 .296-1.471l-1.585-.317-.593-2.668a.75.75 0 0 0-.367-.373ZM13.293 15.707a.75.75 0 0 1 0-1.06l1.5-1.5a.75.75 0 1 1 1.06 1.06l-.72.72h1.617a.75.75 0 0 1 0 1.5h-1.618l.72.72a.75.75 0 0 1-1.06 1.06l-1.5-1.5Z" />
                        </svg>
                        {targetLang === 'original' ? 'Extraer texto' : 'Traducir documento'}
                    </>
                )}
            </button>

            {/* ── Result message ──────────────────────────────────── */}
            {result && (
                <div className="space-y-4">
                    {/* Status badge */}
                    <div
                        className={`flex items-start gap-3 rounded-xl p-4 text-sm ${result.success
                                ? 'bg-emerald-50 text-emerald-800'
                                : 'bg-red-50 text-red-800'
                            }`}
                    >
                        {result.success ? (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 shrink-0 text-emerald-500" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.857-9.809a.75.75 0 0 0-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4-5.5Z" clipRule="evenodd" />
                            </svg>
                        ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 shrink-0 text-red-500" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM8.28 7.22a.75.75 0 0 0-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 1 0 1.06 1.06L10 11.06l1.72 1.72a.75.75 0 1 0 1.06-1.06L11.06 10l1.72-1.72a.75.75 0 0 0-1.06-1.06L10 8.94 8.28 7.22Z" clipRule="evenodd" />
                            </svg>
                        )}
                        <div>
                            <p className="font-medium">{result.success ? (targetLang === 'original' ? '¡Extracción completada!' : '¡Traducción completada!') : 'Error en la operación'}</p>
                            <p className="mt-1 opacity-80">{result.message}</p>
                            {result.fileName && (
                                <p className="mt-2 text-xs font-mono opacity-60">Archivo: {result.fileName}</p>
                            )}
                        </div>
                    </div>

                    {/* Translated text panel */}
                    {result.success && result.translatedText && (
                        <div className="rounded-xl border border-gray-200 bg-gray-50">
                            <div className="flex items-center justify-between border-b border-gray-200 px-4 py-2.5">
                                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{targetLang === 'original' ? 'Texto extraído' : 'Texto traducido'}</span>
                                <div className="flex items-center gap-1">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            navigator.clipboard.writeText(result.translatedText ?? '');
                                        }}
                                        className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50 transition-colors cursor-pointer"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                                            <path d="M7 3.5A1.5 1.5 0 0 1 8.5 2h3.879a1.5 1.5 0 0 1 1.06.44l3.122 3.12A1.5 1.5 0 0 1 17 6.622V12.5a1.5 1.5 0 0 1-1.5 1.5h-1v-3.379a3 3 0 0 0-.879-2.121L10.5 5.379A3 3 0 0 0 8.379 4.5H7v-1Z" />
                                            <path d="M4.5 6A1.5 1.5 0 0 0 3 7.5v9A1.5 1.5 0 0 0 4.5 18h7a1.5 1.5 0 0 0 1.5-1.5v-5.879a1.5 1.5 0 0 0-.44-1.06L9.44 6.44A1.5 1.5 0 0 0 8.378 6H4.5Z" />
                                        </svg>
                                        Copiar
                                    </button>
                                </div>
                            </div>
                            <div className="max-h-80 overflow-y-auto p-4">
                                <pre className="whitespace-pre-wrap text-sm leading-relaxed text-gray-800 font-sans">
                                    {result.translatedText}
                                </pre>
                            </div>
                        </div>
                    )}

                    {/* Download button */}
                    {result.success && result.translatedText && result.fileName && (
                        <button
                            type="button"
                            onClick={handleDownload}
                            disabled={isDownloading}
                            className={`
                flex w-full items-center justify-center gap-2 rounded-xl px-6 py-3
                text-sm font-semibold shadow-sm transition-all duration-200
                ${isDownloading
                                    ? 'bg-emerald-200 text-emerald-600 cursor-not-allowed'
                                    : 'bg-emerald-600 text-white hover:bg-emerald-700 active:scale-[0.98] cursor-pointer'
                                }
              `}
                        >
                            {isDownloading ? (
                                <>
                                    <svg className="h-5 w-5 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4Zm2 5.291A7.962 7.962 0 0 1 4 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647Z" />
                                    </svg>
                                    Generando archivo…
                                </>
                            ) : (
                                <>
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                        <path d="M10.75 2.75a.75.75 0 0 0-1.5 0v8.614L6.295 8.235a.75.75 0 1 0-1.09 1.03l4.25 4.5a.75.75 0 0 0 1.09 0l4.25-4.5a.75.75 0 0 0-1.09-1.03l-2.955 3.129V2.75Z" />
                                        <path d="M3.5 12.75a.75.75 0 0 0-1.5 0v2.5A2.75 2.75 0 0 0 4.75 18h10.5A2.75 2.75 0 0 0 18 15.25v-2.5a.75.75 0 0 0-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5Z" />
                                    </svg>
                                    Descargar {outputFormat.toUpperCase()}
                                </>
                            )}
                        </button>
                    )}
                </div>
            )}
        </form>
    );
}
