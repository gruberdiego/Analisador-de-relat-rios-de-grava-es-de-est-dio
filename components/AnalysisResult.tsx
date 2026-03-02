
import React, { useEffect, useRef } from 'react';
import type { AnalysisResultData, SheetRow, Filter, ChartData } from '../types';
import AnalysisAnimation from './AnalysisAnimation';
import { useTheme } from '../contexts/ThemeContext';
import { typeMapping } from '../types';
import { DownloadIcon } from './Icons';

// Declaração para a biblioteca Chart.js carregada globalmente via CDN
declare const Chart: any;

// --- Funções Auxiliares para Geração de Imagem ---

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

function formatFilters(filters: Filter[]): string {
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

// --- Componentes do Gráfico ---

interface ChartsProps {
  chart?: ChartData;
  analysisPrompt: string;
  activeFilters: Filter[];
}

const ChartComponent: React.FC<{ chart: ChartData, analysisPrompt: string, activeFilters: Filter[] }> = ({ chart, analysisPrompt, activeFilters }) => {
    const { theme } = useTheme();
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const chartRef = useRef<any>(null);

    useEffect(() => {
        if (!canvasRef.current) return;
        
        const ctx = canvasRef.current.getContext('2d');
        if (!ctx) return;
        
        if (chartRef.current) {
            chartRef.current.destroy();
        }

        const labels = chart.data.map(d => d.label);
        const data = chart.data.map(d => d.value);

        const themeChartColors = theme.hex.chartColors;
        
        // Simplificação das cores: 
        // Bar chart: usa apenas uma cor (a primária) para evitar poluição visual.
        // Pie chart: usa a paleta completa para distinguir as fatias.
        const backgroundColors = chart.type === 'pie' 
            ? labels.map((_, i) => themeChartColors[i % themeChartColors.length])
            : theme.hex.primary;
        
        const gridColor = 'rgba(255, 255, 255, 0.1)';
        const textColor = theme.hex.muted;

        const config: any = {
            type: chart.type,
            data: {
                labels,
                datasets: [{
                    label: chart.title,
                    data,
                    backgroundColor: backgroundColors,
                    borderColor: theme.hex.backgroundCard,
                    borderWidth: chart.type === 'pie' ? 2 : 1,
                    borderRadius: chart.type === 'bar' ? 4 : 0,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                aspectRatio: chart.type === 'pie' ? 1.5 : 2,
                plugins: {
                    legend: {
                        // Exibe legenda apenas se for pizza ou se houver labels significativos
                        display: chart.type === 'pie' && chart.data.length > 1,
                        position: 'bottom',
                        labels: {
                            color: textColor,
                            padding: 20,
                            font: {
                                family: 'Inter, sans-serif',
                                size: 12
                            }
                        }
                    },
                    title: {
                        display: true,
                        text: chart.title,
                        color: theme.hex.base,
                        padding: {
                            bottom: 20
                        },
                        font: {
                            size: 16,
                            family: 'Inter, sans-serif',
                            weight: '600'
                        }
                    },
                    tooltip: {
                        backgroundColor: theme.hex.backgroundMain,
                        titleColor: theme.hex.strong,
                        bodyColor: theme.hex.base
                    }
                },
            }
        };

        if (chart.type === 'bar') {
            config.options.indexAxis = 'y'; // Gráfico de barras horizontais para melhor leitura de nomes longos
            config.options.scales = {
                y: {
                    beginAtZero: true,
                    grid: { display: false },
                    ticks: { color: textColor }
                },
                x: {
                    grid: { color: gridColor },
                    ticks: { color: textColor }
                }
            };
            // Remove a legenda em gráficos de barra de métrica única (mais limpo)
            config.options.plugins.legend.display = false;
        }
        
        chartRef.current = new Chart(ctx, config);

        return () => {
            if (chartRef.current) {
                chartRef.current.destroy();
            }
        };
    }, [chart, theme]);

    const handleDownload = async () => {
        if (!canvasRef.current) return;
        await document.fonts.ready;
    
        const originalCanvas = canvasRef.current;
        const { width, height } = originalCanvas;
        
        const padding = 20;
        const sectionSpacing = 15;
        const questionLineHeight = 22;
        const filterTitleLineHeight = 20;
        const filterLineHeight = 18;
    
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = width;
        tempCanvas.height = 10000;
        const tempCtx = tempCanvas.getContext('2d');
        if (!tempCtx) return;
    
        let textY = 0;
    
        tempCtx.font = `bold 18px Inter, sans-serif`;
        textY = wrapText(tempCtx, `Pergunta: ${analysisPrompt}`, 0, textY, width - padding * 2, questionLineHeight);
        textY += sectionSpacing;
        
        const filtersText = formatFilters(activeFilters);
        if (filtersText) {
            tempCtx.font = `bold 16px Inter, sans-serif`;
            textY = wrapText(tempCtx, 'Filtros Aplicados:', 0, textY, width - padding * 2, filterTitleLineHeight);
            textY += 5;
            tempCtx.font = `14px Inter, sans-serif`;
            textY = wrapText(tempCtx, filtersText, 0, textY, width - padding * 2, filterLineHeight);
        }
    
        const finalHeight = height + textY + padding;
        
        const finalCanvas = document.createElement('canvas');
        finalCanvas.width = width;
        finalCanvas.height = finalHeight;
        const finalCtx = finalCanvas.getContext('2d');
        if (!finalCtx) return;
    
        finalCtx.fillStyle = theme.hex.backgroundCard;
        finalCtx.fillRect(0, 0, width, finalHeight);
        finalCtx.drawImage(originalCanvas, 0, 0);
    
        let currentY = height + padding;
        finalCtx.textBaseline = 'top';
    
        finalCtx.font = `bold 18px Inter, sans-serif`;
        finalCtx.fillStyle = theme.hex.strong;
        currentY = wrapText(finalCtx, `Pergunta: ${analysisPrompt}`, padding, currentY, width - padding * 2, questionLineHeight);
        currentY += sectionSpacing;
    
        if (filtersText) {
            finalCtx.font = `bold 16px Inter, sans-serif`;
            finalCtx.fillStyle = theme.hex.strong;
            currentY = wrapText(finalCtx, 'Filtros Aplicados:', padding, currentY, width - padding * 2, filterTitleLineHeight);
            currentY += 5;
            finalCtx.font = `14px Inter, sans-serif`;
            finalCtx.fillStyle = theme.hex.base;
            wrapText(finalCtx, filtersText, padding, currentY, width - padding * 2, filterLineHeight);
        }
    
        const link = document.createElement('a');
        link.href = finalCanvas.toDataURL('image/png');
        const fileName = `${chart.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}.png`;
        link.download = fileName || 'grafico.png';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="relative">
            <canvas ref={canvasRef}></canvas>
            <button
                onClick={handleDownload}
                title="Baixar gráfico"
                aria-label="Baixar imagem do gráfico"
                className="absolute top-0 right-0 p-1.5 bg-blue-900/50 text-blue-200 rounded-full hover:bg-blue-800 hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
                <DownloadIcon className="w-4 h-4" />
            </button>
        </div>
    );
}

const Charts: React.FC<ChartsProps> = ({ chart, analysisPrompt, activeFilters }) => {
    const { theme } = useTheme();

    if (!chart) {
        return null;
    }

    return (
        <div className="pt-6 border-t border-blue-800 mt-6 flex justify-center">
            <div className={`p-6 rounded-lg ${theme.classNames.background.highlight} w-full max-w-4xl`}>
                <ChartComponent chart={chart} analysisPrompt={analysisPrompt} activeFilters={activeFilters} />
            </div>
        </div>
    );
};


// --- Componente de Markdown ---

const SimpleMarkdown: React.FC<{ text: string }> = ({ text }) => {
    const normalizedText = text.replace(/\\n/g, '\n');

    let html = normalizedText
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>');

    html = html.replace(/((?:^- .*(?:\r\n|\n|$))+)/gm, (match) => {
        const items = match
            .trim()
            .split(/\r\n|\n/)
            .map(item => `<li class="ml-4">${item.substring(2).trim()}</li>`)
            .join('');
        return `<ul class="list-disc list-inside space-y-1">${items}</ul>`;
    });

    const parts = html.split(/(<ul.*?>.*?<\/ul>)/gs);
    
    const processedHtml = parts.map(part => {
        if (part.startsWith('<ul') || part.trim() === '') {
            return part;
        }
        
        return part.trim().split(/\n\s*\n/).map(p => 
            `<p>${p.replace(/\n/g, '<br />')}</p>`
        ).join('');
    }).join('');

    return <div className="prose prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: processedHtml }} />;
};


// --- Componente Principal do Resultado ---

interface AnalysisResultProps {
  result: AnalysisResultData | null;
  isLoading: boolean;
  error: string | null;
  analyzedRowCount: number | null;
  summaryImage: string | null;
  sheetData: SheetRow[];
  fileName: string;
  activeFilters: Filter[];
  analysisProgress: {current: number, total: number, step: string} | null;
  analysisPrompt: string;
}

const AnalysisResult: React.FC<AnalysisResultProps> = ({ result, isLoading, error, analyzedRowCount, summaryImage, sheetData, fileName, activeFilters, analysisProgress, analysisPrompt }) => {
  const { theme } = useTheme();

  if (isLoading) {
    return (
      <div className={`${theme.classNames.background.card} p-6 rounded-lg shadow-md ${theme.classNames.border} border flex flex-col items-center justify-center min-h-[300px]`}>
        <AnalysisAnimation sheetData={sheetData} fileName={fileName} analysisProgress={analysisProgress} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-900/30 border border-red-500/50 text-red-400 p-6 rounded-lg shadow-md">
        <h3 className="font-semibold text-red-300">Erro na Análise</h3>
        <p>{error}</p>
      </div>
    );
  }

  if (!result) {
    return null;
  }

  return (
    <div className={`${theme.classNames.background.card} p-6 rounded-lg shadow-md ${theme.classNames.border} border space-y-6`}>
      <div className="flex justify-between items-baseline">
        <h3 className="text-lg font-semibold text-slate-100">Resultado da Análise</h3>
        {analyzedRowCount !== null && (
          <p className={`text-sm ${theme.classNames.text.muted}`}>
            {analyzedRowCount.toLocaleString('pt-BR')} {analyzedRowCount === 1 ? 'linha processada' : 'linhas processadas'}
          </p>
        )}
      </div>

      {activeFilters.length > 0 && (
          <div className={`${theme.classNames.background.input} p-3 rounded-md border ${theme.classNames.border}`}>
            <h4 className={`text-sm font-semibold mb-2 ${theme.classNames.text.strong}`}>Filtros Aplicados:</h4>
            <div className="flex flex-wrap items-center gap-2">
              {activeFilters.map(filter => {
                let displayValue: string;
                if (typeof filter.value === 'object' && filter.value !== null) {
                    const { start, end } = filter.value;
                    const formatDate = (dateStr?: string) => dateStr ? new Date(dateStr + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '';
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

                return (
                  <span key={filter.id} className="bg-blue-800 text-slate-200 text-xs font-medium px-2 py-0.5 rounded-full">
                    {filter.column}: {displayValue}
                  </span>
                );
              })}
            </div>
          </div>
      )}

      {result.dadosInvalidos && result.dadosInvalidos.length > 0 && (
        <div className="bg-yellow-900/30 border border-yellow-500/50 text-yellow-300 p-4 rounded-lg">
            <h4 className="font-semibold text-yellow-200 mb-2">Aviso: Foram encontrados dados potencialmente inconsistentes</h4>
            <p className="text-sm mb-3">A análise foi concluída, mas as seguintes linhas podem conter erros que afetam a precisão do resultado. Recomenda-se revisar estes itens na planilha original:</p>
            <ul className="text-sm space-y-1 list-disc list-inside">
                {result.dadosInvalidos.map((item, index) => (
                    <li key={index}>
                        <strong>Linha {item.identificadorLinha} ({item.primeiraColunaDado || 'Data não informada'}{item.nomePrograma ? ` | ${item.nomePrograma}` : ''}):</strong> {item.descricaoProblema}
                    </li>
                ))}
            </ul>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <SimpleMarkdown text={result.resumo} />
        </div>
        {summaryImage && (
          <div className="flex flex-col items-center justify-center">
            <img src={summaryImage} alt="Resumo da Análise" className="rounded-lg shadow-lg border-2 border-slate-700 w-full" />
            <a 
              href={summaryImage} 
              download={`resumo-${fileName}.jpeg`}
              className={`mt-3 inline-block ${theme.classNames.secondaryButton.bg} ${theme.classNames.secondaryButton.text} font-semibold py-2 px-4 rounded-md ${theme.classNames.secondaryButton.hover} transition duration-150 text-sm`}
            >
              Baixar Imagem do Resumo
            </a>
          </div>
        )}
      </div>
      
      {result.chart && (
          <Charts chart={result.chart} analysisPrompt={analysisPrompt} activeFilters={activeFilters} />
      )}

    </div>
  );
};

export default AnalysisResult;
