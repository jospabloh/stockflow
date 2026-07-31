import {
  Snowflake,
  Heart,
  Flower2,
  CloudRain,
  Flower,
  Sun,
  Waves,
  Sunset,
  Wheat,
  Leaf,
  Wind,
  Gift,
} from "lucide-react";

/**
 * Temas decorativos mensuales: solo dos ejes de tono (primary/secondary),
 * cada uno con variante light/dark curada a mano, espejando los mismos dos
 * ejes que hoy usa index.css (índigo → --primary/--brand/--ring/--chart-1/
 * --sidebar-primary, cian → --brand-2/--chart-2). Índice 0 = enero, igual
 * que Date#getMonth().
 */
export const MONTHLY_THEMES = [
  {
    label: "Enero",
    icon: Snowflake,
    iconLabel: "Copo de nieve",
    light: { primary: "231 70% 60%", secondary: "199 80% 45%" },
    dark: { primary: "231 70% 68%", secondary: "199 80% 55%" },
  },
  {
    label: "Febrero",
    icon: Heart,
    iconLabel: "Corazón",
    light: { primary: "340 70% 58%", secondary: "320 60% 50%" },
    dark: { primary: "340 70% 66%", secondary: "320 60% 60%" },
  },
  {
    label: "Marzo",
    icon: Flower2,
    iconLabel: "Flor",
    light: { primary: "150 55% 42%", secondary: "168 60% 38%" },
    dark: { primary: "150 55% 52%", secondary: "168 60% 48%" },
  },
  {
    label: "Abril",
    icon: CloudRain,
    iconLabel: "Nube de lluvia",
    light: { primary: "250 75% 62%", secondary: "195 80% 44%" },
    dark: { primary: "250 75% 70%", secondary: "195 80% 54%" },
  },
  {
    label: "Mayo",
    icon: Flower,
    iconLabel: "Flor",
    light: { primary: "320 60% 58%", secondary: "150 55% 42%" },
    dark: { primary: "320 60% 66%", secondary: "150 55% 52%" },
  },
  {
    label: "Junio",
    icon: Sun,
    iconLabel: "Sol",
    light: { primary: "40 90% 48%", secondary: "199 80% 45%" },
    dark: { primary: "40 90% 58%", secondary: "199 80% 55%" },
  },
  {
    label: "Julio",
    icon: Waves,
    iconLabel: "Olas",
    light: { primary: "199 80% 52%", secondary: "170 60% 38%" },
    dark: { primary: "199 80% 62%", secondary: "170 60% 48%" },
  },
  {
    label: "Agosto",
    icon: Sunset,
    iconLabel: "Atardecer",
    light: { primary: "20 85% 54%", secondary: "340 60% 50%" },
    dark: { primary: "20 85% 62%", secondary: "340 60% 58%" },
  },
  {
    label: "Septiembre",
    icon: Wheat,
    iconLabel: "Trigo",
    light: { primary: "30 70% 46%", secondary: "160 55% 38%" },
    dark: { primary: "30 70% 55%", secondary: "160 55% 48%" },
  },
  {
    label: "Octubre",
    icon: Leaf,
    iconLabel: "Hoja",
    light: { primary: "25 82% 52%", secondary: "270 55% 45%" },
    dark: { primary: "25 82% 60%", secondary: "270 55% 55%" },
  },
  {
    label: "Noviembre",
    icon: Wind,
    iconLabel: "Viento",
    light: { primary: "20 55% 45%", secondary: "45 55% 42%" },
    dark: { primary: "20 55% 55%", secondary: "45 55% 52%" },
  },
  {
    label: "Diciembre",
    icon: Gift,
    iconLabel: "Regalo",
    light: { primary: "0 62% 48%", secondary: "150 45% 32%" },
    dark: { primary: "0 62% 58%", secondary: "150 45% 42%" },
  },
];

const STYLE_TAG_ID = "sf-monthly-theme";

function buildCss(theme) {
  const rule = (vars) =>
    `--primary:${vars.primary};--brand:${vars.primary};--ring:${vars.primary};` +
    `--chart-1:${vars.primary};--sidebar-primary:${vars.primary};--sidebar-ring:${vars.primary};` +
    `--brand-2:${vars.secondary};--chart-2:${vars.secondary};`;
  return `:root{${rule(theme.light)}}.dark{${rule(theme.dark)}}`;
}

export function getMonthlyTheme(date = new Date()) {
  return MONTHLY_THEMES[date.getMonth()];
}

/**
 * Aplica la paleta del mes inyectando un <style> con reglas :root/.dark
 * reales (no estilos inline) para que la cascada respete la clase .dark
 * que alterna next-themes, en vez de pisar por igual claro y oscuro.
 * Puramente decorativo: nunca debe romper el arranque de la app.
 */
export function applyMonthlyTheme(date = new Date()) {
  try {
    const theme = getMonthlyTheme(date);
    if (!theme) return;
    let styleEl = document.getElementById(STYLE_TAG_ID);
    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.id = STYLE_TAG_ID;
      document.head.appendChild(styleEl);
    }
    styleEl.textContent = buildCss(theme);
  } catch (_) {
    // Decorativo: nunca debe romper el arranque de la app.
  }
}

if (import.meta.env.DEV && typeof window !== "undefined") {
  window.__sfPreviewMonth = (monthIndex, year = new Date().getFullYear()) =>
    applyMonthlyTheme(new Date(year, monthIndex, 1));
}
