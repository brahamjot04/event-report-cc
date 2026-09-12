/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect, useCallback } from "react";

const ThemeContext = createContext({
  darkMode: false,
  toggleTheme: () => {},
  setDarkMode: () => {},
});

export function ThemeProvider({ children }) {
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem("theme");
    if (saved === "dark") return true;
    if (saved === "light") return false;
    return (
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches
    );
  });

  useEffect(() => {
    const targetThemeColor = darkMode ? "#1e1e1e" : "#ffffff";
    if (darkMode) {
      document.documentElement.setAttribute("data-theme", "dark");
      document.documentElement.setAttribute("data-bs-theme", "dark");
    } else {
      document.documentElement.removeAttribute("data-theme");
      document.documentElement.removeAttribute("data-bs-theme");
    }

    // Update mobile browser status bar / notch color dynamically
    const themeColorMetaTags = document.querySelectorAll('meta[name="theme-color"]');
    themeColorMetaTags.forEach((tag) => tag.setAttribute("content", targetThemeColor));
  }, [darkMode]);

  // Listen to OS system theme changes if user hasn't manually set a preference
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = (e) => {
      if (!localStorage.getItem("theme")) {
        setDarkMode(e.matches);
      }
    };
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  const toggleTheme = useCallback(() => {
    setDarkMode((prev) => {
      const next = !prev;
      localStorage.setItem("theme", next ? "dark" : "light");
      return next;
    });
  }, []);

  return (
    <ThemeContext.Provider value={{ darkMode, toggleTheme, setDarkMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    return {
      darkMode: false,
      toggleTheme: () => {},
      setDarkMode: () => {},
    };
  }
  return context;
};
