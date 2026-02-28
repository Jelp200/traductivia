/* ──────────────────────────────────────────────────────────────
   TraductivIA – Generador de archivos PDF y DOCX
   ──────────────────────────────────────────────────────────────
   Recibe texto traducido y genera un archivo binario descargable.
   ────────────────────────────────────────────────────────────── */

import PDFDocument from 'pdfkit';
import {
    Document,
    Packer,
    Paragraph,
    TextRun,
    HeadingLevel,
    AlignmentType,
} from 'docx';
import type { OutputFormat } from '../types/translation';

/* ── PDF Generation ───────────────────────────────────────── */

/**
 * Genera un buffer PDF a partir de texto plano/markdown simple.
 */
async function generatePdf(text: string, fileName: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({
            size: 'A4',
            margins: { top: 60, bottom: 60, left: 55, right: 55 },
            info: {
                Title: fileName,
                Author: 'TraductivIA',
                Creator: 'TraductivIA MVP',
            },
        });

        const chunks: Uint8Array[] = [];
        doc.on('data', (chunk: Uint8Array) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        /* ── Header ─────────────────────────────────────────── */
        doc
            .fontSize(8)
            .fillColor('#9ca3af')
            .text('TraductivIA — Documento traducido', { align: 'right' });

        doc.moveDown(2);

        /* ── Body: parse simple markdown ────────────────────── */
        const lines = text.split('\n');

        for (const line of lines) {
            const trimmed = line.trimStart();

            // Heading ## or #
            if (trimmed.startsWith('## ')) {
                doc.moveDown(0.5);
                doc.fontSize(14).fillColor('#1e293b').text(trimmed.replace(/^##\s+/, ''), { align: 'left' });
                doc.moveDown(0.3);
                continue;
            }
            if (trimmed.startsWith('# ')) {
                doc.moveDown(0.5);
                doc.fontSize(18).fillColor('#0f172a').text(trimmed.replace(/^#\s+/, ''), { align: 'left' });
                doc.moveDown(0.4);
                continue;
            }
            if (trimmed.startsWith('### ')) {
                doc.moveDown(0.3);
                doc.fontSize(12).fillColor('#334155').text(trimmed.replace(/^###\s+/, ''), { align: 'left' });
                doc.moveDown(0.2);
                continue;
            }

            // Bullet list
            if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
                doc.fontSize(11).fillColor('#1e293b').text(`  •  ${trimmed.slice(2)}`, { align: 'left' });
                continue;
            }

            // Empty line → paragraph break
            if (trimmed === '') {
                doc.moveDown(0.5);
                continue;
            }

            // Regular paragraph
            doc.fontSize(11).fillColor('#1e293b').text(trimmed, {
                align: 'left',
                lineGap: 3,
            });
        }

        /* ── Footer ─────────────────────────────────────────── */
        doc.moveDown(2);
        doc
            .fontSize(7)
            .fillColor('#d1d5db')
            .text('Generado automáticamente por TraductivIA', { align: 'center' });

        doc.end();
    });
}

/* ── DOCX Generation ──────────────────────────────────────── */

/**
 * Genera un buffer DOCX a partir de texto plano/markdown simple.
 */
async function generateDocx(text: string, _fileName: string): Promise<Buffer> {
    const lines = text.split('\n');
    const paragraphs: Paragraph[] = [];

    for (const line of lines) {
        const trimmed = line.trimStart();

        // Headings
        if (trimmed.startsWith('### ')) {
            paragraphs.push(
                new Paragraph({
                    text: trimmed.replace(/^###\s+/, ''),
                    heading: HeadingLevel.HEADING_3,
                    spacing: { before: 120, after: 60 },
                })
            );
            continue;
        }
        if (trimmed.startsWith('## ')) {
            paragraphs.push(
                new Paragraph({
                    text: trimmed.replace(/^##\s+/, ''),
                    heading: HeadingLevel.HEADING_2,
                    spacing: { before: 200, after: 80 },
                })
            );
            continue;
        }
        if (trimmed.startsWith('# ')) {
            paragraphs.push(
                new Paragraph({
                    text: trimmed.replace(/^#\s+/, ''),
                    heading: HeadingLevel.HEADING_1,
                    spacing: { before: 240, after: 120 },
                })
            );
            continue;
        }

        // Bullet list
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
            paragraphs.push(
                new Paragraph({
                    children: [
                        new TextRun({ text: trimmed.slice(2), size: 22 }),
                    ],
                    bullet: { level: 0 },
                    spacing: { after: 40 },
                })
            );
            continue;
        }

        // Empty line → empty paragraph
        if (trimmed === '') {
            paragraphs.push(new Paragraph({ text: '' }));
            continue;
        }

        // Regular paragraph
        paragraphs.push(
            new Paragraph({
                children: [
                    new TextRun({ text: trimmed, size: 22, font: 'Calibri' }),
                ],
                alignment: AlignmentType.LEFT,
                spacing: { after: 80, line: 300 },
            })
        );
    }

    // Add footer credit
    paragraphs.push(new Paragraph({ text: '' }));
    paragraphs.push(
        new Paragraph({
            children: [
                new TextRun({
                    text: 'Generado automáticamente por TraductivIA',
                    size: 16,
                    color: 'd1d5db',
                    italics: true,
                }),
            ],
            alignment: AlignmentType.CENTER,
        })
    );

    const doc = new Document({
        creator: 'TraductivIA',
        title: _fileName,
        description: 'Documento traducido con TraductivIA',
        sections: [
            {
                properties: {
                    page: {
                        margin: {
                            top: 1440,    // 1 inch in twips
                            right: 1200,
                            bottom: 1440,
                            left: 1200,
                        },
                    },
                },
                children: paragraphs,
            },
        ],
    });

    const buffer = await Packer.toBuffer(doc);
    return Buffer.from(buffer);
}

/* ── Exported function ────────────────────────────────────── */

/**
 * Genera un archivo (PDF o DOCX) a partir del texto traducido.
 *
 * @param text         Texto traducido.
 * @param format       Formato de salida ('pdf' | 'docx').
 * @param fileName     Nombre base del archivo (sin extensión).
 * @returns            Buffer del archivo generado.
 */
export async function generateFile(
    text: string,
    format: OutputFormat,
    fileName: string
): Promise<{ buffer: Buffer; mimeType: string; extension: string }> {
    if (format === 'pdf') {
        const buffer = await generatePdf(text, fileName);
        return {
            buffer,
            mimeType: 'application/pdf',
            extension: 'pdf',
        };
    }

    const buffer = await generateDocx(text, fileName);
    return {
        buffer,
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        extension: 'docx',
    };
}
