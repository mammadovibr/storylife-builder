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

function createBookScheme(
  name: string,
  ornamentStyle: Extract<SceneOrnamentStyle, `book-${string}`>,
  backgroundFrom: string,
  backgroundTo: string,
  panelColor: string,
  titleColor: string,
  accent: string,
  textColor: string,
  titleTextColor: string
): SceneColorSchemePreset {
  return {
    name,
    colors: {
      ornamentStyle,
      backgroundColor: `linear-gradient(145deg, ${backgroundFrom} 0%, ${backgroundTo} 100%)`,
      textColor,
      titlePanelColor: titleColor,
      titleBorderColor: accent,
      titleTextColor,
      titleBorderEnabled: true,
      titlePanelTransparent: false,
      titlePanelOpacity: 0.92,
      textPanelColor: panelColor,
      textBorderColor: accent,
      textBorderEnabled: true,
      textPanelTransparent: false,
      textPanelOpacity: 0.9,
      choicesPanelColor: panelColor,
      choicesBorderColor: accent,
      choicesTextColor: textColor,
      choicesBorderEnabled: true,
      choicesPanelTransparent: false,
      choicesPanelOpacity: 0.94,
      choicesFrameStyle: "none",
      textFontFamily: "serif",
      choicesFontFamily: "serif"
    }
  };
}

export const BOOK_COLOR_SCHEME_PRESETS: SceneColorSchemePreset[] = [
  createBookScheme("Worn Antique Folio", "book-antique", "#c4a16a", "#f0dda9", "#f4e5bd", "#68452a", "#8a642f", "#392819", "#fff1c5"),
  createBookScheme("Embossed Leather Ledger", "book-leather", "#26150f", "#633924", "#ead8ae", "#3f2518", "#c99a4d", "#332216", "#ffe7a0"),
  createBookScheme("Botanical Field Journal", "book-botanical", "#d8d0ad", "#f6f1d9", "#f6f1d9", "#456044", "#71825b", "#263729", "#f4f0d7"),
  createBookScheme("Enchanted Story Volume", "book-enchanted", "#0c1437", "#344a86", "#182854", "#23366c", "#e2c66f", "#fff5d0", "#fff0a8"),
  createBookScheme("Noir Pocket Novel", "book-noir", "#242424", "#cbc6ba", "#e9e4d8", "#1c1c1c", "#9d1f2c", "#181818", "#f5efe3")
];
