import { __ertr } from './i18n';

export interface ThemeColors {
  bg: string;
  text: string;
  ui: string;
  border: string;
  accent: string;
  muted: string;
}

export const THEMES: Record<string, ThemeColors> = {
  auto: {
    bg: "var(--background-primary)",
    text: "var(--text-normal)",
    ui: "var(--background-secondary)",
    border: "var(--background-modifier-border)",
    accent: "var(--interactive-accent)",
    muted: "var(--text-muted)",
  },
  // Maximum contrast, no tinting: anything softer turns to mush on an e-ink panel.
  eink: {
    bg: "#ffffff",
    text: "#000000",
    ui: "#ffffff",
    border: "#000000",
    accent: "#000000",
    muted: "#444444"
  },
  dark: {
    bg: "#12121a",
    text: "#ddd8f0",
    ui: "#1c1c2a",
    border: "#2e2e45",
    accent: "#7c6af7",
    muted: "#6a6880"
  },
  light: {
    bg: "#faf8f3",
    text: "#1a1a2e",
    ui: "#f0ede5",
    border: "#ddd9ce",
    accent: "#5548d9",
    muted: "#8a8678"
  },
  sepia: {
    bg: "#f5efe3",
    text: "#2c2416",
    ui: "#ece4d2",
    border: "#cfc4a8",
    accent: "#8B6914",
    muted: "#9a8a68"
  }
};

export function erTheme(settings: any): ThemeColors {
  const s = settings || {};
  if (s.einkMode === true) return THEMES.eink;
  return THEMES[s.theme] || THEMES.auto;
}

export function erLibTheme(settings: any): ThemeColors {
  const s = settings || {};
  const mode = s.libTheme || "auto";
  if (mode === "reader") return erTheme(s);
  if (s.einkMode === true) return THEMES.eink;
  return THEMES[mode] || THEMES.auto;
}

export const FONTS: Record<string, string> = {
  georgia: "Georgia,'Times New Roman',serif",
  lora: "'Lora',Georgia,serif",
  inter: "'Inter',system-ui,sans-serif"
};

export function getHighlightColors(): Array<{ id: string; name: string; css: string }> {
  return [
    { id: "yellow", name: __ertr("Yellow"), css: "rgba(255,206,64,.45)" },
    { id: "green", name: __ertr("Green"), css: "rgba(118,214,108,.42)" },
    { id: "blue", name: __ertr("Blue"), css: "rgba(96,165,250,.42)" },
    { id: "pink", name: __ertr("Pink"), css: "rgba(248,123,168,.42)" }
  ];
}

export const HL_COLORS = getHighlightColors();

export function hlColorCss(id: string): string {
  const colors = getHighlightColors();
  const c = colors.find((x) => x.id === id);
  return c ? c.css : colors[0].css;
}
