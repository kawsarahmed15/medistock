import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { themeStore } from "./storage";

type Theme = "light" | "dark";
type ThemeCtx = {
  theme: Theme;
  toggle: (event?: React.MouseEvent | MouseEvent) => void;
  setTheme: (t: Theme, event?: React.MouseEvent | MouseEvent) => void;
};

const Ctx = createContext<ThemeCtx | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("light");

  useEffect(() => {
    setThemeState(themeStore.get());
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") root.classList.add("dark");
    else root.classList.remove("dark");
    themeStore.set(theme);
  }, [theme]);

  const apply = (next: Theme) => {
    if (next === theme) return;

    const docAny = document as unknown as {
      startViewTransition?: (cb: () => void) => void;
    };

    if (typeof docAny.startViewTransition === "function" && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      docAny.startViewTransition(() => {
        setThemeState(next);
      });
    } else {
      setThemeState(next);
    }
  };

  return (
    <Ctx.Provider
      value={{
        theme,
        setTheme: apply,
        toggle: (e) => apply(theme === "light" ? "dark" : "light", e),
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useTheme must be used inside ThemeProvider");
  return ctx;
}
