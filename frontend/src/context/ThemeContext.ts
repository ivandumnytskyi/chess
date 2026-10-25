import { createContext, useContext } from "react";

export type ThemeContextValue = {
  themeIndex: number;
  setThemeIndex: (index: number) => void;
  pieceTheme: string;
  setPieceTheme: (theme: string) => void;
};

export const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
