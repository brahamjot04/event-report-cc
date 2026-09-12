import { useTheme } from "../context/ThemeContext";

export default function ThemeToggle({ className = "" }) {
  const { darkMode, toggleTheme } = useTheme();

  return (
    <div
      className={`theme-nav-btn p-2 rounded-circle shadow-sm cursor-pointer d-flex align-items-center justify-content-center ${className}`}
      style={{
        width: 40,
        height: 40,
        backgroundColor: "var(--bg-card)",
        border: "1px solid var(--border-color)",
        transition: "all 0.2s ease",
      }}
      onClick={toggleTheme}
      title={darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
      role="button"
      tabIndex={0}
      aria-label={darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
    >
      <i
        className={`bi ${darkMode ? "bi-sun-fill text-warning" : "bi-moon-stars-fill text-secondary"} fs-5`}
      ></i>
    </div>
  );
}
