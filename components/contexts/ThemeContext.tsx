
import React, { createContext, useContext, useState } from 'react';

export interface Theme {
  name: string;
  classNames: {
    primary: { bg: string; text: string; hover: string; };
    secondaryButton: { bg: string; text: string; hover: string; };
    background: { main: string; card: string; input: string; highlight: string; };
    text: { base: string; muted: string; strong: string; input: string; placeholder: string; };
    border: string;
    focusRing: string;
  };
  hex: {
    primary: string;
    strong: string;
    muted: string;
    base: string;
    backgroundMain: string;
    backgroundCard: string;
    border: string;
    chartColors: string[];
  };
}


export const defaultTheme: Theme = {
  name: 'Estúdio',
  classNames: {
    primary: { bg: 'bg-amber-500', text: 'text-blue-950', hover: 'hover:bg-amber-600' },
    secondaryButton: { bg: 'bg-blue-700', text: 'text-white', hover: 'hover:bg-blue-600' },
    background: { main: 'bg-blue-950', card: 'bg-blue-900', input: 'bg-blue-950', highlight: 'bg-blue-800/50' },
    text: { base: 'text-slate-200', muted: 'text-blue-200', strong: 'text-amber-400', input: 'text-slate-200', placeholder: 'placeholder-blue-300' },
    border: 'border-blue-800',
    focusRing: 'focus:ring-amber-500',
  },
  hex: {
    primary: '#f59e0b',
    strong: '#ffcc00',
    muted: '#bfdbfe',
    base: '#e2e8f0',
    backgroundMain: '#172554',
    backgroundCard: '#1e3a8a',
    border: '#1e40af',
    chartColors: ['#ffcc00', '#003399', '#bfdbfe', '#f87171', '#4ade80', '#a78bfa'],
  },
};

export const themes = {
  estudio: defaultTheme,
};

export type ThemeName = keyof typeof themes;


interface ThemeContextType {
  theme: Theme;
  setTheme: (name: ThemeName) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: defaultTheme,
  setTheme: () => {},
});

export const ThemeProvider: React.FC<{children: React.ReactNode}> = ({ children }) => {
  const [themeName, setThemeName] = useState<ThemeName>('estudio');

  const theme = themes[themeName] || defaultTheme;
  const value = { theme, setTheme: setThemeName };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
