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

  const apply = (next: Theme, event?: React.MouseEvent | MouseEvent) => {
    if (next === theme) return;

    const docAny = document as unknown as {
      startViewTransition?: (cb: () => void) => { ready: Promise<void> };
    };

    if (typeof docAny.startViewTransition === "function" && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const x = event?.clientX ?? window.innerWidth / 2;
      const y = event?.clientY ?? window.innerHeight / 2;
      const endRadius = Math.hypot(
        Math.max(x, window.innerWidth - x),
        Math.max(y, window.innerHeight - y)
      );

      const transition = docAny.startViewTransition(() => {
        setThemeState(next);
      });

      transition.ready.then(() => {
        const clipPath = [
          `circle(0px at ${x}px ${y}px)`,
          `circle(${endRadius}px at ${x}px ${y}px)`,
        ];
        document.documentElement.animate(
          {
            clipPath: next === "dark" ? clipPath : [...clipPath].reverse(),
          },
          {
            duration: 500,
            easing: "cubic-bezier(0.4, 0, 0.2, 1)",
            pseudoElement: next === "dark" ? "::view-transition-new(root)" : "::view-transition-old(root)",
          }
        );
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
