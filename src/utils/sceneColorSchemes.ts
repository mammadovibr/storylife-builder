import type { SceneOrnamentStyle, SceneStyle } from "../domain/project";

export interface SceneColorSchemePreset {
  name: string;
  colors: Partial<SceneStyle>;
}

function createOrnateScheme(
  name: string,
  ornamentStyle: Exclude<SceneOrnamentStyle, "none">,
  backgroundFrom: string,
  backgroundTo: string,
  panelFrom: string,
  panelTo: string,
  accent: string,
  textColor: string
): SceneColorSchemePreset {
  return {
    name,
    colors: {
      ornamentStyle,
      backgroundColor: `linear-gradient(145deg, ${backgroundFrom} 0%, ${backgroundTo} 100%)`,
      textColor,
      titlePanelColor: `linear-gradient(135deg, ${panelFrom} 0%, ${panelTo} 100%)`,
      titleBorderColor: accent,
      titleTextColor: textColor,
      titleBorderEnabled: true,
      titlePanelTransparent: false,
      titlePanelOpacity: 0.92,
      textPanelColor: `linear-gradient(135deg, ${panelFrom} 0%, ${panelTo} 100%)`,
      textBorderColor: accent,
      textBorderEnabled: true,
      textPanelTransparent: false,
      textPanelOpacity: 0.9,
      choicesPanelColor: `linear-gradient(135deg, ${panelTo} 0%, ${panelFrom} 100%)`,
      choicesBorderColor: accent,
      choicesTextColor: textColor,
      choicesBorderEnabled: true,
      choicesPanelTransparent: false,
      choicesPanelOpacity: 0.94,
      choicesFrameStyle: "none"
    }
  };
}

export const ORNATE_COLOR_SCHEME_PRESETS: SceneColorSchemePreset[] = [
  createOrnateScheme("Gilded Chronicle", "gilded", "#17130d", "#4a3519", "#211a10", "#60451e", "#e2bc69", "#fff2ca"),
  createOrnateScheme("Moonlit Gothic", "gothic", "#090d17", "#252d45", "#111827", "#303a56", "#b9c8e4", "#f0f4ff"),
  createOrnateScheme("Enchanted Forest", "forest", "#08241b", "#3f6146", "#123428", "#49684d", "#d5c67b", "#f5f5d8"),
  createOrnateScheme("Crimson Court", "crimson", "#24070d", "#741f2f", "#370d16", "#84283a", "#e8b96a", "#fff0da"),
  createOrnateScheme("Oceanic Myth", "ocean", "#041d2a", "#087e92", "#0b3041", "#116f80", "#75e1df", "#ecffff"),
  createOrnateScheme("Celestial Archive", "celestial", "#0a102b", "#44376f", "#141c3e", "#514280", "#ebd67a", "#fff9db"),
  createOrnateScheme("Noir Marquee", "noir", "#08090b", "#34363b", "#14161a", "#3f4146", "#e5d8b8", "#fffaf0"),
  createOrnateScheme("Sakura Dream", "sakura", "#351427", "#a44d73", "#52203a", "#b35d82", "#ffd0dd", "#fff4f7"),
  createOrnateScheme("Desert Relic", "desert", "#2d1709", "#9a5c1f", "#43230e", "#93602b", "#58d1c5", "#fff1cd"),
  createOrnateScheme("Frostbound", "frost", "#071a2c", "#477c9e", "#102d43", "#5686a3", "#d5f4ff", "#f3fdff"),
  createOrnateScheme("Neon Circuit", "cyber", "#080a1b", "#35115b", "#10142c", "#48206b", "#27e6dc", "#f1fbff"),
  createOrnateScheme("Fairytale Royal", "fairytale", "#111d4b", "#60358a", "#1c2c64", "#704598", "#f2c866", "#fff5d6")
];
