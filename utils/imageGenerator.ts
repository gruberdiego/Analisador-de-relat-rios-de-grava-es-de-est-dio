

import type { Theme } from '../contexts/ThemeContext';
import type { Filter } from '../types';
import { typeMapping } from '../types';

type HexColors = Theme['hex'];

// Função auxiliar para quebrar texto em um canvas
function wrapText(
    context: CanvasRenderingContext2D, 
    text: string, 
    x: number, 
    y: number, 
    maxWidth: number, 
    lineHeight: number
): number {
    const paragraphs = text.split('\n');
    let currentY = y;

    for (const paragraph of paragraphs) {
        const words = paragraph.split(' ');
        let line = '';

        for (let n = 0; n < words.length; n++) {
            const testLine = line + words[n] + ' ';
            const metrics = context.measureText(testLine);
            const testWidth = metrics.width;
            if (testWidth > maxWidth && n > 0) {
                context.fillText(line.trim(), x, currentY);
                line = words[n] + ' ';
                currentY += lineHeight;
            } else {
                line = testLine;
            }
        }
        context.fillText(line.trim(), x, currentY);
        currentY += lineHeight;
    }
    
    return currentY;
}

function formatFiltersForImage(filters: Filter[]): string {
    if (filters.length === 0) {
        return '';
    }

    return filters.map(filter => {
        let displayValue: string;
        if (typeof filter.value === 'object' && filter.value !== null) {
            const { start, end } = filter.value as { start?: string; end?: string };
            const formatDate = (dateStr?: string) => dateStr ? new Date(dateStr + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '...';
            if (start && end) {
                displayValue = `${formatDate(start)} - ${formatDate(end)}`;
            } else if (start) {
                displayValue = `a partir de ${formatDate(start)}`;
            } else if (end) {
                displayValue = `até ${formatDate(end)}`;
            } else {
                displayValue = 'Intervalo de data inválido';
            }
        } else {
            let tempDisplayValue = filter.value as string;
            if (filter.column.toLowerCase().includes('tipo') && typeof tempDisplayValue === 'string' && typeMapping[tempDisplayValue.toUpperCase()]) {
                tempDisplayValue = typeMapping[tempDisplayValue.toUpperCase()];
            }
            displayValue = tempDisplayValue;
        }
        return `• ${filter.column}: ${displayValue}`;
    }).join('\n');
}

export const generateSummaryImage = async (question: string, answer: string, filters: Filter[], colors: HexColors): Promise<string> => {
    // Garante que as fontes sejam carregadas antes de desenhar no canvas
    await document.fonts.ready;
    
    const tempCanvas = document.createElement('canvas');
    const ctx = tempCanvas.getContext('2d');
    if (!ctx) return '';

    const width = 800;
    const padding = 40;
    const contentWidth = width - padding * 2;
    const lineHeightTitle = 34;
    const lineHeightBody = 26;
    const sectionSpacing = 20;
    
    tempCanvas.width = width;
    tempCanvas.height = 32000; // Usa uma altura temporária muito grande para evitar o corte de texto longo

    let currentY = padding;

    // --- Desenha a Pergunta ---
    ctx.textBaseline = 'top';
    ctx.font = `bold 24px Inter, sans-serif`;
    ctx.fillStyle = colors.strong;
    currentY = wrapText(ctx, `Pergunta: ${question}`, padding, currentY, contentWidth, lineHeightTitle);

    currentY += sectionSpacing;

    // --- Desenha Filtros ---
    const filtersText = formatFiltersForImage(filters);
    if (filtersText) {
        ctx.font = `bold 20px Inter, sans-serif`;
        ctx.fillStyle = colors.strong;
        currentY = wrapText(ctx, 'Filtros Aplicados:', padding, currentY, contentWidth, 30);
        currentY += 10;

        ctx.font = `16px Inter, sans-serif`;
        ctx.fillStyle = colors.base;
        currentY = wrapText(ctx, filtersText, padding, currentY, contentWidth, 24);
        
        currentY += sectionSpacing;
    }

    // --- Desenha a Linha Separadora ---
    ctx.fillStyle = colors.primary;
    ctx.fillRect(padding, currentY, contentWidth, 2);
    currentY += 2;
    
    currentY += sectionSpacing;

    // --- Desenha a Resposta ---
    ctx.font = `18px Inter, sans-serif`;
    ctx.fillStyle = colors.base;
    
    // Normaliza quebras de linha literais (\n) para quebras reais e formata a lista
    const normalizedAnswer = answer.replace(/\\n/g, '\n');
    const cleanAnswer = normalizedAnswer
        .replace(/\*\*(.*?)\*\*/g, '$1') // Remove negrito
        .replace(/\*(.*?)\*/g, '$1')    // Remove itálico
        .replace(/^- /gm, '• ')         // Substitui marcadores de lista no início da linha
        .replace(/\n\s*\n/g, '\n');     // Remove linhas em branco extras entre parágrafos
    
    currentY = wrapText(ctx, `Resposta: ${cleanAnswer}`, padding, currentY, contentWidth, lineHeightBody);
    
    const finalHeight = currentY + padding; 

    // Cria um novo canvas com a altura exata e copia o conteúdo
    const finalCanvas = document.createElement('canvas');
    finalCanvas.width = width;
    finalCanvas.height = finalHeight;
    const finalCtx = finalCanvas.getContext('2d');

    if (!finalCtx) return '';

    // Define o plano de fundo no canvas final
    finalCtx.fillStyle = colors.backgroundCard;
    finalCtx.fillRect(0, 0, width, finalHeight);

    // Copia o conteúdo desenhado do canvas temporário
    finalCtx.drawImage(tempCanvas, 0, 0);

    return finalCanvas.toDataURL('image/jpeg');
};
