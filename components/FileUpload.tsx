
import React, { useState } from 'react';
import { UploadIcon, LinkIcon } from './Icons';
import { useTheme } from '../contexts/ThemeContext';

interface FileUploadProps {
  onFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onUrlSubmit: (url: string, year?: string) => Promise<void>;
  fileName: string;
  isLoading: boolean;
}

const quickLinks = [
  { year: '2022', url: 'https://docs.google.com/spreadsheets/d/1FkCfwiRYZnbN1FB-40ny6Idf-V1EtnnhvRNkfRKrQ2s/edit?usp=drivesdk' },
  { year: '2023', url: 'https://docs.google.com/spreadsheets/d/16flxqAkItsQsg1Euy-X2CWsZpYS8HkNmj2-TNh4lGto/edit?usp=drivesdk' },
  { year: '2024', url: 'https://docs.google.com/spreadsheets/d/1rrff2LSFZ-J0_MkFv7ayetHwp_f7M3Zx2FV7Bu5Mkpo/edit?usp=drivesdk' },
  { year: '2025', url: 'https://docs.google.com/spreadsheets/d/1woc9nuEXb8b5_B1F3PnlBC79st0IVS462s8MMWG0ymM/edit?usp=drivesdk' },
  { year: '2026', url: 'https://docs.google.com/spreadsheets/d/17nmydItb8z8ZYQMhI1nzP8DmQuvuXUuEZvDNxt1B37o/edit?usp=drivesdk' },
];

const FileUpload: React.FC<FileUploadProps> = ({ onFileChange, onUrlSubmit, fileName, isLoading }) => {
  const { theme } = useTheme();
  const [activeTab, setActiveTab] = useState<'file' | 'url'>('url');
  const [url, setUrl] = useState('');

  const handleUrlFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (url) {
      onUrlSubmit(url);
    }
  };

  const tabClass = (tabName: 'file' | 'url') => 
    `px-4 py-2 text-sm font-medium rounded-t-md cursor-pointer transition-colors focus:outline-none disabled:cursor-not-allowed ${
      activeTab === tabName 
        ? `bg-blue-900 text-amber-400 border-b-2 border-amber-500`
        : `text-blue-200 hover:bg-blue-800/50`
    }`;

  return (
    <div className="w-full">
      <div className={`flex border-b ${theme.classNames.border}`}>
        <button onClick={() => setActiveTab('url')} className={tabClass('url')} disabled={isLoading}>
          Importar de URL
        </button>
        <button onClick={() => setActiveTab('file')} className={tabClass('file')} disabled={isLoading}>
          Carregar Arquivo
        </button>
      </div>

      <div className="pt-6">
        {activeTab === 'file' && (
          <div className="flex flex-col items-center justify-center w-full">
            <label
              htmlFor="dropzone-file"
              className={`flex flex-col items-center justify-center w-full h-32 border-2 ${theme.classNames.border} border-dashed rounded-lg cursor-pointer ${theme.classNames.background.highlight} hover:bg-blue-800 transition`}
            >
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                <UploadIcon className={`w-10 h-10 mb-3 ${theme.classNames.text.muted}`} />
                <p className={`mb-2 text-sm ${theme.classNames.text.muted}`}>
                  <span className={`font-semibold ${theme.classNames.text.strong}`}>Clique para carregar</span> ou arraste e solte
                </p>
                <p className={`text-xs ${theme.classNames.text.muted}`}>XLSX, XLS, CSV, ou ODS</p>
              </div>
              <input id="dropzone-file" type="file" className="hidden" onChange={onFileChange} accept=".xlsx, .xls, .csv, .ods" disabled={isLoading} />
            </label>
            {fileName && !fileName.startsWith('URL:') && !fileName.startsWith('Registros') && (
              <p className={`mt-4 text-sm ${theme.classNames.text.base} font-medium`}>
                Arquivo selecionado: <span className={theme.classNames.text.strong}>{fileName}</span>
              </p>
            )}
          </div>
        )}
        
        {activeTab === 'url' && (
          <div className="w-full space-y-6">
            <div className="space-y-3 text-center">
                <h3 className={`text-sm font-semibold ${theme.classNames.text.muted}`}>Carregamento Rápido</h3>
                <div className="flex justify-center flex-wrap gap-2">
                    {quickLinks.map(link => (
                        <button
                            key={link.year}
                            onClick={() => onUrlSubmit(link.url, link.year)}
                            disabled={isLoading}
                            className={`flex-1 min-w-[80px] sm:flex-none ${theme.classNames.secondaryButton.bg} ${theme.classNames.secondaryButton.text} font-bold py-2 px-4 rounded-md ${theme.classNames.secondaryButton.hover} disabled:opacity-50 disabled:cursor-not-allowed transition duration-150`}
                        >
                            {`Ano ${link.year}`}
                        </button>
                    ))}
                </div>
            </div>

            <div className="relative flex items-center">
                <div className={`flex-grow border-t ${theme.classNames.border}`}></div>
                <span className={`flex-shrink mx-4 text-xs ${theme.classNames.text.muted}`}>OU</span>
                <div className={`flex-grow border-t ${theme.classNames.border}`}></div>
            </div>

            <div className="space-y-2">
                <p className={`${theme.classNames.text.muted} text-sm text-center`}>
                Cole o link de uma Planilha Google pública. Certifique-se que o compartilhamento esteja como "Qualquer pessoa com o link".
                </p>
                <form onSubmit={handleUrlFormSubmit} className="flex flex-col sm:flex-row gap-2">
                <input 
                    type="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://docs.google.com/spreadsheets/d/..."
                    disabled={isLoading}
                    className={`flex-grow p-3 ${theme.classNames.background.input} ${theme.classNames.text.input} ${theme.classNames.border} border rounded-md focus:outline-none ${theme.classNames.focusRing} ${theme.classNames.text.placeholder} transition-shadow disabled:opacity-50`}
                />
                <button
                    type="submit"
                    disabled={isLoading || !url}
                    className={`flex items-center justify-center gap-2 ${theme.classNames.primary.bg} ${theme.classNames.primary.text} font-bold py-3 px-4 rounded-md ${theme.classNames.primary.hover} disabled:opacity-50 disabled:cursor-not-allowed transition duration-150`}
                >
                    <LinkIcon className="w-5 h-5" />
                    Carregar
                </button>
                </form>
            </div>
          </div>
        )}

        {fileName && fileName.startsWith('URL:') && (
            <p className={`mt-4 text-sm ${theme.classNames.text.base} font-medium text-center`}>
            Planilha carregada de: <span className={`${theme.classNames.text.strong} font-mono`}>{fileName}</span>
            </p>
        )}
      </div>
    </div>
  );
};

export default FileUpload;
