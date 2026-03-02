import React from 'react';
import { useTheme, themes } from '../contexts/ThemeContext';

const ThemeSwitcher: React.FC = () => {
  const { theme, setTheme } = useTheme();

  return (
    <div className="flex items-center space-x-2">
      {(Object.keys(themes) as Array<keyof typeof themes>).map((themeKey) => {
        const themeOption = themes[themeKey];
        const primaryColor = themeOption.hex.chartColors[0];
        return (
          <button
            key={themeOption.name}
            title={themeOption.name}
            onClick={() => setTheme(themeKey)}
            className={`w-6 h-6 rounded-full transition-transform duration-150 ease-in-out focus:outline-none ${
              theme.name === themeOption.name
                ? 'ring-2 ring-offset-2 ring-offset-gray-800'
                : ''
            }`}
            style={{ 
              backgroundColor: primaryColor,
              boxShadow: `0 0 8px 0 ${primaryColor}66`,
              borderColor: primaryColor
            }}
          >
            &nbsp;
          </button>
        );
      })}
    </div>
  );
};

export default ThemeSwitcher;
