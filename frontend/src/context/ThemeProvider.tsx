import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ThemeContext } from "./ThemeContext";

const DEFAULT_PIECE_THEME = "staunty";
const STORAGE_KEY = "chess-theme";

type StoredTheme = { themeIndex: number; pieceTheme: string };

const DEFAULT_THEME: StoredTheme = { themeIndex: 0, pieceTheme: DEFAULT_PIECE_THEME };

function loadTheme(): StoredTheme {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_THEME;
    const parsed = JSON.parse(raw) as Partial<StoredTheme>;
    return {
      themeIndex: typeof parsed.themeIndex === "number" ? parsed.themeIndex : DEFAULT_THEME.themeIndex,
      pieceTheme: typeof parsed.pieceTheme === "string" ? parsed.pieceTheme : DEFAULT_THEME.pieceTheme,
    };
  } catch {
    return DEFAULT_THEME;
  }
}

export default function ThemeProvider({ children }: { children: ReactNode }) {
  const [initial] = useState(loadTheme);
  const [themeIndex, setThemeIndex] = useState(initial.themeIndex);
  const [pieceTheme, setPieceTheme] = useState(initial.pieceTheme);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ themeIndex, pieceTheme }));
  }, [themeIndex, pieceTheme]);

  const value = useMemo(
    () => ({ themeIndex, setThemeIndex, pieceTheme, setPieceTheme }),
    [themeIndex, pieceTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
