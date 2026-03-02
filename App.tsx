
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { type AnalysisResultData, type SheetRow, type Filter } from './types';
import { analyzeSpreadsheetData, correctUserPrompt } from './services/geminiService';
import { generateSummaryImage } from './utils/imageGenerator';
import FileUpload from './components/FileUpload';
import DataTable from './components/DataTable';
import AnalysisResult from './components/AnalysisResult';
import FilterControls from './components/FilterControls';
import { LoadingSpinner, MicrophoneIcon, CloseIcon, InfoIcon } from './components/Icons';
import { useTheme } from './contexts/ThemeContext';

// Esta é uma declaração global para a biblioteca xlsx carregada da CDN
declare const XLSX: any;

// Para a API de Reconhecimento de Fala
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

const App: React.FC = () => {
  const { theme } = useTheme();
  const [sheetData, setSheetData] = useState<SheetRow[]>([]);
  const [fileName, setFileName] = useState<string>('');
  const [analysisPrompt, setAnalysisPrompt] = useState<string>('Qual estúdio e qual equipe são os mais produtivos em termos de horas gravadas?');
  const [additionalContext, setAdditionalContext] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isCorrectingPrompt, setIsCorrectingPrompt] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [promptCorrectionError, setPromptCorrectionError] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResultData | null>(null);
  const [isListening, setIsListening] = useState<boolean>(false);
  const [analyzedRowCount, setAnalyzedRowCount] = useState<number | null>(null);
  const [summaryImage, setSummaryImage] = useState<string | null>(null);
  const [analysisProgress, setAnalysisProgress] = useState<{current: number, total: number, step: string} | null>(null);
  const recognitionRef = useRef<any>(null);
  const promptTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Estado para os filtros
  const [availableColumns, setAvailableColumns] = useState<string[]>([]);
  const [columnValues, setColumnValues] = useState<Record<string, string[]>>({});
  const [activeFilters, setActiveFilters] = useState<Filter[]>([]);

  useEffect(() => {
    document.body.className = theme.classNames.background.main;
  }, [theme]);
  
  // Configura o Reconhecimento de Fala
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.lang = 'pt-BR';
      recognitionRef.current.interimResults = false;

      recognitionRef.current.onstart = () => setIsListening(true);
      recognitionRef.current.onend = () => setIsListening(false);
      recognitionRef.current.onerror = (event: any) => {
        console.error('Speech recognition error', event.error);
        setIsListening(false);
      };
      recognitionRef.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setAnalysisPrompt(transcript);
      };
    }
  }, []);

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
    } else {
      recognitionRef.current?.start();
    }
  };

  const filteredData = useMemo(() => {
    if (activeFilters.length === 0) {
      return sheetData;
    }
    return sheetData.filter(row => {
      return activeFilters.every(filter => {
        const cellValue = row[filter.column];

        if (typeof filter.value === 'object' && filter.value !== null) { // Filtro de intervalo de datas
          let dateFromCell: Date | null = null;
          if (cellValue instanceof Date && !isNaN(cellValue.getTime())) {
            dateFromCell = cellValue;
          } else if (typeof cellValue === 'string') {
            const parts = cellValue.split('/');
            if (parts.length === 3) {
              const year = parseInt(parts[2]);
              const fullYear = year < 100 ? 2000 + year : year;
              const d = new Date(fullYear, parseInt(parts[1]) - 1, parseInt(parts[0]));
              if (!isNaN(d.getTime())) dateFromCell = d;
            }
          } else if (typeof cellValue === 'number') { // Data serial do Excel
            const d = new Date(Math.round((cellValue - 25569) * 86400 * 1000));
            if (!isNaN(d.getTime())) dateFromCell = d;
          }

          if (!dateFromCell) return false;

          const cellDate = new Date(dateFromCell.getFullYear(), dateFromCell.getMonth(), dateFromCell.getDate());
          const { start, end } = filter.value as { start?: string; end?: string };
          
          let passesStart = true;
          if (start) {
            const startDate = new Date(start + 'T00:00:00');
            if (!isNaN(startDate.getTime())) passesStart = cellDate.getTime() >= startDate.getTime();
          }
          
          let passesEnd = true;
          if (end) {
            const endDate = new Date(end + 'T00:00:00');
            if (!isNaN(endDate.getTime())) passesEnd = cellDate.getTime() <= endDate.getTime();
          }
          
          return passesStart && passesEnd;
        }

        if (cellValue instanceof Date) {
          return cellValue.toLocaleDateString('pt-BR') === filter.value;
        }

        return String(cellValue ?? '').trim().toLowerCase() === String(filter.value).trim().toLowerCase();
      });
    });
  }, [sheetData, activeFilters]);

  const processWorkbook = (workbook: any, name: string) => {
    try {
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const data: SheetRow[] = XLSX.utils.sheet_to_json(worksheet, { raw: false, dateNF: 'dd/mm/yyyy' });

        if (data.length > 0) {
          const dataWithIndices = data.map((row, index) => ({
            ...row,
            __originalRowIndex: index + 2, // A linha 1 é o cabeçalho, os dados começam na linha 2
          }));

          const columns = Object.keys(data[0]);
          setAvailableColumns(columns);

          const uniqueValues: Record<string, Set<string>> = {};
          columns.forEach(col => {
            uniqueValues[col] = new Set();
          });

          data.forEach(row => {
            columns.forEach(col => {
                const value = row[col];
                if (value !== null && value !== undefined && String(value).trim() !== '') {
                   uniqueValues[col].add(String(value).trim());
                }
            });
          });
          
          const columnValuesMap: Record<string, string[]> = {};
          columns.forEach(col => {
            columnValuesMap[col] = Array.from(uniqueValues[col]).sort();
          });

          setColumnValues(columnValuesMap);
          setSheetData(dataWithIndices);
        } else {
            setError("A planilha está vazia ou em um formato não suportado.");
        }
        setFileName(name);
        setActiveFilters([]);
        setAnalysisResult(null);
        setError(null);
        setSummaryImage(null);
    } catch (err) {
        console.error("Error processing workbook: ", err);
        const errorMessage = err instanceof Error ? err.message : String(err);
        setError(`Ocorreu um erro ao processar a planilha: ${errorMessage}. Verifique se o arquivo está em um formato suportado e se a primeira linha contém os cabeçalhos das colunas.`);
        setSheetData([]);
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setIsLoading(true);
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array', cellDates: true });
          processWorkbook(workbook, file.name);
        } catch (err) {
            console.error("Error processing file:", err);
            const errorMessage = err instanceof Error ? err.message : String(err);
            setError(`Erro ao processar o arquivo: ${errorMessage}. Verifique se é um arquivo de planilha válido.`);
        } finally {
            setIsLoading(false);
        }
      };
      reader.onerror = () => {
          setError("Não foi possível ler o arquivo selecionado.");
          setIsLoading(false);
      }
      reader.readAsArrayBuffer(file);
    }
  };

  const handleUrlSubmit = async (url: string, year?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const sheetIdMatch = url.match(/\/d\/(.*?)\//);
      if (!sheetIdMatch) {
        throw new Error("URL da Planilha Google inválida. Não foi possível encontrar o ID.");
      }
      const sheetId = sheetIdMatch[1];
      const exportUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=xlsx`;
      
      const response = await fetch(exportUrl);
      if (!response.ok) {
        throw new Error(`Falha ao buscar a planilha. Status: ${response.status}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      const data = new Uint8Array(arrayBuffer);
      const workbook = XLSX.read(data, { type: 'array', cellDates: true });
      const nameToSet = year ? `Registros ${year}` : (workbook.Props?.Title || `URL: ${sheetId.substring(0, 12)}...`);
      processWorkbook(workbook, nameToSet);

    } catch (err: any) {
      console.error(err);
      setError(`Erro ao carregar da URL: ${err.message}. Verifique se o link está correto e com permissão de 'Qualquer pessoa com o link'.`);
      setSheetData([]);
    } finally {
      setIsLoading(false);
    }
  };

  const addFilter = (filter: Omit<Filter, 'id'>) => {
    setActiveFilters(prev => [...prev, { ...filter, id: Date.now() }]);
  };

  const removeFilter = (filterId: number) => {
    setActiveFilters(prev => prev.filter(f => f.id !== filterId));
  };

  const handleCorrectPrompt = async () => {
    if (!analysisPrompt.trim()) return;
    setIsCorrectingPrompt(true);
    setPromptCorrectionError(null);
    try {
        const corrected = await correctUserPrompt(analysisPrompt);
        setAnalysisPrompt(corrected);
    } catch(e: any) {
        console.error("Failed to correct prompt", e.message);
        setPromptCorrectionError(e.message);
    } finally {
        setIsCorrectingPrompt(false);
        promptTextareaRef.current?.focus();
    }
  };
  
  const getAnalysisPeriod = (data: SheetRow[]): string => {
    if (data.length === 0) return "Período de análise não pôde ser determinado.";
    const dateColumn = Object.keys(data[0] || {}).find(key => key.toLowerCase().includes('data'));
    if (!dateColumn) return "Período de análise não pôde ser determinado.";

    const dates = data.map(row => {
        const cellValue = row[dateColumn];
        if (cellValue instanceof Date && !isNaN(cellValue.getTime())) return cellValue;
        if (typeof cellValue === 'string') {
            const parts = cellValue.split('/');
            if (parts.length === 3) {
                const year = parseInt(parts[2]);
                const fullYear = year < 100 ? 2000 + year : year;
                const d = new Date(fullYear, parseInt(parts[1]) - 1, parseInt(parts[0]));
                if (!isNaN(d.getTime())) return d;
            }
        }
        return null;
    }).filter((d): d is Date => d !== null);

    if (dates.length === 0) return "Período de análise não pôde ser determinado.";

    const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
    const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));
    
    const formatDate = (d: Date) => d.toLocaleDateString('pt-BR', {timeZone: 'UTC', day: '2-digit', month: '2-digit', year: '2-digit'});
    
    return `Período analisado: de ${formatDate(minDate)} a ${formatDate(maxDate)}`;
  }

  const handleAnalysis = async () => {
    if (filteredData.length === 0 || !analysisPrompt.trim()) {
      setError("Por favor, carregue uma planilha e faça uma pergunta para iniciar a análise.");
      return;
    }
    setIsLoading(true);
    setError(null);
    setAnalysisResult(null);
    setSummaryImage(null);
    setAnalyzedRowCount(null);
    setAnalysisProgress(null);

    try {
      const periodoAnalise = getAnalysisPeriod(filteredData);
      const result = await analyzeSpreadsheetData(
        filteredData, 
        analysisPrompt, 
        activeFilters, 
        periodoAnalise,
        setAnalysisProgress,
        additionalContext
      );
      setAnalysisResult(result);
      setAnalyzedRowCount(filteredData.length);

      // Passamos apenas o analysisPrompt para a imagem, ignorando o additionalContext conforme solicitado.
      const image = await generateSummaryImage(analysisPrompt, result.resumo, activeFilters, theme.hex);
      setSummaryImage(image);

    } catch (err: any) {
      setError(err.message || "Ocorreu um erro desconhecido durante a análise.");
    } finally {
      setIsLoading(false);
      setAnalysisProgress(null);
    }
  };

  return (
    <div className={`min-h-screen ${theme.classNames.text.base} p-4 sm:p-6 lg:p-8`}>
      <div className="max-w-7xl mx-auto space-y-8">
        <header className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-100">Analisador de Planilhas de Estúdio</h1>
            <p className={theme.classNames.text.muted}>Use IA para extrair insights dos registros de gravação.</p>
          </div>
        </header>

        <main className="space-y-6">
          <section className={`${theme.classNames.background.card} p-6 rounded-lg shadow-md ${theme.classNames.border} border`}>
            <div className="flex flex-col gap-6">
              {/* Novo Campo de Contexto Adicional */}
              <div>
                <h2 className="text-lg font-semibold text-slate-100 mb-1">Contexto / Parâmetros Adicionais</h2>
                <p className={`${theme.classNames.text.muted} text-xs mb-2`}>Informe parâmetros extras ou informações que a IA deve usar para fundamentar a análise.</p>
                <textarea
                  value={additionalContext}
                  onChange={(e) => setAdditionalContext(e.target.value)}
                  placeholder="Ex: Considere que o Estúdio B esteve em reforma durante julho. As equipes Alpha e Beta trabalham em turnos de 6h."
                  rows={2}
                  disabled={isLoading || sheetData.length === 0}
                  className={`w-full p-3 ${theme.classNames.background.input} ${theme.classNames.text.input} ${theme.classNames.border} border rounded-md focus:outline-none ${theme.classNames.focusRing} ${theme.classNames.text.placeholder} transition-shadow disabled:opacity-50 resize-none`}
                />
              </div>

              {/* Campo de Pergunta Principal */}
              <div>
                <h2 className="text-lg font-semibold text-slate-100 mb-1">Pergunta da Análise</h2>
                {fileName ? (
                  <p className={`${theme.classNames.text.muted} text-sm mb-2`}>
                    Analisando dados do arquivo: <span className='font-bold text-amber-400'>{fileName}</span>
                  </p>
                ) : (
                  <p className={`${theme.classNames.text.muted} text-sm mb-2`}>
                    Carregue uma planilha para começar a análise.
                  </p>
                )}
                <div className="relative">
                  <textarea
                    ref={promptTextareaRef}
                    value={analysisPrompt}
                    onChange={(e) => {
                      setAnalysisPrompt(e.target.value);
                      if (promptCorrectionError) setPromptCorrectionError(null);
                    }}
                    placeholder="Ex: Qual programa teve mais cancelamentos? Qual equipe teve o melhor aproveitamento de horas no Estúdio A?"
                    rows={3}
                    disabled={isLoading || sheetData.length === 0}
                    className={`w-full p-3 pr-28 ${theme.classNames.background.input} ${theme.classNames.text.input} ${theme.classNames.border} border rounded-md focus:outline-none ${theme.classNames.focusRing} ${theme.classNames.text.placeholder} transition-shadow disabled:opacity-50 resize-none`}
                  />
                  <div className="absolute top-1/2 right-3 transform -translate-y-1/2 flex items-center gap-2">
                    {analysisPrompt && (
                      <button
                        onClick={() => setAnalysisPrompt('')}
                        disabled={isLoading}
                        className={`${theme.classNames.text.muted} hover:text-white p-1 rounded-full hover:bg-blue-800 transition-colors`}
                        aria-label="Limpar pergunta"
                      >
                        <CloseIcon className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={toggleListening}
                      disabled={isLoading || !recognitionRef.current || sheetData.length === 0}
                      className={`p-2 rounded-full transition-colors ${isListening ? 'bg-red-500 text-white animate-pulse' : `${theme.classNames.text.muted} hover:bg-blue-800`}`}
                      aria-label={isListening ? 'Parar gravação' : 'Gravar pergunta'}
                    >
                      <MicrophoneIcon className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
            
            {promptCorrectionError && <p className="text-sm text-red-400 mt-2 px-1">{promptCorrectionError}</p>}
            
            {sheetData.length > 0 && (
              <div className="mt-4 text-xs text-blue-200 bg-blue-950/50 p-3 rounded-lg flex items-start gap-2 border border-blue-800">
                <InfoIcon className="w-4 h-4 mt-0.5 flex-shrink-0 text-amber-400" />
                <div>
                  <strong className="font-semibold text-slate-100">Dica de Análise:</strong> A pergunta principal é o que aparecerá na imagem gerada. Use o campo de contexto para dados técnicos ou específicos que não precisam figurar no relatório visual.
                </div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-2 mt-4">
                <button
                    onClick={handleAnalysis}
                    disabled={isLoading || filteredData.length === 0}
                    className={`w-full sm:w-auto flex-grow ${theme.classNames.primary.bg} ${theme.classNames.primary.text} font-bold py-3 px-6 rounded-md ${theme.classNames.primary.hover} disabled:opacity-50 disabled:cursor-not-allowed transition duration-150 flex items-center justify-center gap-2`}
                >
                    {isLoading ? <LoadingSpinner className="w-5 h-5" /> : 'Analisar Dados'}
                </button>
                <button
                    onClick={handleCorrectPrompt}
                    disabled={isLoading || isCorrectingPrompt || !analysisPrompt || sheetData.length === 0}
                    className={`w-full sm:w-auto ${theme.classNames.secondaryButton.bg} ${theme.classNames.secondaryButton.text} font-semibold py-3 px-4 rounded-md ${theme.classNames.secondaryButton.hover} disabled:opacity-50 disabled:cursor-not-allowed transition duration-150 flex items-center justify-center gap-2`}
                >
                    {isCorrectingPrompt ? <LoadingSpinner className="w-5 h-5" /> : 'Corrigir Texto'}
                </button>
            </div>
          </section>

          <AnalysisResult 
            result={analysisResult} 
            isLoading={isLoading && sheetData.length > 0} 
            error={error} 
            analyzedRowCount={analyzedRowCount}
            summaryImage={summaryImage}
            sheetData={filteredData}
            fileName={fileName}
            activeFilters={activeFilters}
            analysisProgress={analysisProgress}
            analysisPrompt={analysisPrompt}
          />

          <section className={`${theme.classNames.background.card} p-6 rounded-lg shadow-md ${theme.classNames.border} border`}>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold text-slate-100">Filtros e Visualização dos Dados</h2>
              </div>
              {sheetData.length > 0 ? (
                <>
                  <p className={`${theme.classNames.text.muted} text-sm mb-4`}>
                    Refine os dados para a análise. A tabela abaixo mostra {filteredData.length.toLocaleString('pt-BR')} de {sheetData.length.toLocaleString('pt-BR')} linhas.
                  </p>
                  <FilterControls 
                    availableColumns={availableColumns}
                    columnValues={columnValues}
                    activeFilters={activeFilters}
                    onAddFilter={addFilter}
                    onRemoveFilter={removeFilter}
                    disabled={isLoading}
                  />
                  <div className="mt-4">
                    <DataTable data={filteredData.slice(0, 100)} />
                    {filteredData.length > 100 && (
                        <p className={`text-xs ${theme.classNames.text.muted} text-center mt-2`}>
                            Apenas as primeiras 100 linhas filtradas são exibidas na tabela.
                        </p>
                    )}
                  </div>
                </>
              ) : (
                <div className="text-center py-10">
                    <p className={`${theme.classNames.text.muted}`}>
                        Carregue uma planilha para visualizar e filtrar os dados.
                    </p>
                </div>
              )}
          </section>

          <section className={`${theme.classNames.background.card} p-6 rounded-lg shadow-md ${theme.classNames.border} border`}>
            <h2 className="text-lg font-semibold text-slate-100 mb-4">Importar / Carregar Arquivo</h2>
            <FileUpload 
              onFileChange={handleFileChange}
              onUrlSubmit={handleUrlSubmit}
              fileName={fileName}
              isLoading={isLoading}
            />
          </section>

        </main>
        
        <footer className={`text-center py-4 text-sm ${theme.classNames.text.muted}`}>
            <p>&copy; {new Date().getFullYear()} Analisador de Planilhas. Criado com a API Gemini.</p>
        </footer>
      </div>
    </div>
  );
};

export default App;
