import type { CSSProperties } from "react";
import { applyColorOpacity } from "./colorOpacity";

interface ChoiceButtonFrame {
  id: string;
  label: string;
  background: string;
  border: string;
  borderRadius: string;
  color: string;
}

export const CHOICE_BUTTON_FRAMES: ChoiceButtonFrame[] = [
  frame("crafted_01", "Parchment Gold", "linear-gradient(135deg, #fff3ce, #d9b66f)", "#8d6425", "14px", "#3f2d15"),
  frame("crafted_02", "Obsidian Ruby", "linear-gradient(135deg, #25252a, #09090b)", "#a83246", "8px", "#fff1f3"),
  frame("crafted_03", "Emerald Leaves", "linear-gradient(135deg, #d9efc4, #618f4e)", "#315e35", "18px 8px", "#17371e"),
  frame("crafted_04", "Royal Sapphire", "linear-gradient(135deg, #183f82, #091d48)", "#d4ae4e", "12px", "#fff0b8"),
  frame("crafted_05", "Crimson Gothic", "linear-gradient(135deg, #711d2b, #24070e)", "#c65a68", "4px 16px", "#ffe9ec"),
  frame("crafted_06", "Frost Silver", "linear-gradient(135deg, #f4fbff, #9fc8df)", "#7599b4", "20px 8px", "#17324a"),
  frame("crafted_07", "Arcane Violet", "linear-gradient(135deg, #6b2fb1, #220844)", "#bd80ff", "16px", "#f8eaff"),
  frame("crafted_08", "Old Oak", "linear-gradient(135deg, #9b6335, #4a2816)", "#d09a55", "10px", "#fff0d2"),
  frame("crafted_09", "Steampunk", "linear-gradient(135deg, #a86b2f, #3d2113)", "#d2a15b", "6px 18px", "#fff1cf"),
  frame("crafted_10", "Neon Circuit", "linear-gradient(135deg, #103447, #06141e)", "#18d9ed", "4px", "#bffaff"),
  frame("crafted_11", "Rose Gold", "linear-gradient(135deg, #ffd9df, #bd7180)", "#9d5060", "22px", "#4e202a"),
  frame("crafted_12", "Black Minimal", "linear-gradient(135deg, #202124, #070708)", "#c7a553", "2px", "#f4dfaa"),
  frame("crafted_13", "Sandstone", "linear-gradient(135deg, #ead4a5, #a9804d)", "#79552d", "3px 15px", "#402c19"),
  frame("crafted_14", "Ocean Pearl", "linear-gradient(135deg, #d8ffff, #66aeb5)", "#e9ffff", "24px 10px", "#143d45"),
  frame("crafted_15", "Forest Leather", "linear-gradient(135deg, #68492c, #261a12)", "#60864d", "10px 2px", "#f1e5c5"),
  frame("crafted_16", "Celestial Navy", "linear-gradient(135deg, #173b72, #070d24)", "#e1bd5b", "14px 4px", "#fff0b0"),
  frame("crafted_17", "Copper Industrial", "linear-gradient(135deg, #a85d37, #4a2418)", "#d1835a", "7px", "#fff0e1"),
  frame("crafted_18", "Jade Geometry", "linear-gradient(135deg, #b9dfae, #3f805d)", "#c6a65b", "2px 16px", "#173c2b"),
  frame("crafted_19", "Amber Art Deco", "linear-gradient(135deg, #d58a19, #5c2c08)", "#ffd060", "2px 20px", "#fff2bd"),
  frame("crafted_20", "Ink Wash", "linear-gradient(135deg, #f4f1e8, #b8b4a9)", "#36383d", "0 14px", "#202226"),
  frame("crafted_21", "Deckled Parchment", "radial-gradient(circle at 8% 18%, #8b6738 0 2px, transparent 3px), radial-gradient(circle at 91% 78%, #9c7541 0 2px, transparent 3px), linear-gradient(135deg, #f7e8bd, #c8a467)", "#7d592d", "3px 13px 4px 15px", "#3b2917"),
  frame("crafted_22", "Leather Stitching", "repeating-linear-gradient(90deg, #56331f 0 12px, #68412a 12px 24px)", "#d2a660", "7px", "#fff0c9"),
  frame("crafted_23", "Botanical Margins", "radial-gradient(ellipse at 4% 15%, #547548 0 5px, transparent 6px), radial-gradient(ellipse at 96% 82%, #6e8d58 0 6px, transparent 7px), linear-gradient(135deg, #f4efd7, #d8d1a8)", "#667a50", "16px 4px", "#293a27"),
  frame("crafted_24", "Chapter Ink", "repeating-linear-gradient(0deg, #f2eddf 0 8px, #e6dfcf 8px 9px)", "#292b2d", "1px", "#17191b"),
  frame("crafted_25", "Illuminated Manuscript", "radial-gradient(circle at 8% 50%, #f0cf67 0 3px, transparent 4px), radial-gradient(circle at 92% 50%, #f0cf67 0 3px, transparent 4px), linear-gradient(135deg, #304b89, #14244f)", "#e1bf5e", "4px 18px", "#fff1b7"),
  frame("crafted_26", "Library Green", "repeating-linear-gradient(45deg, #1b4d3b 0 10px, #245d47 10px 20px)", "#d1b66d", "2px 12px", "#fff5d2"),
  frame("crafted_27", "Fairytale Marginalia", "radial-gradient(circle at 12% 25%, #f4d36b 0 2px, transparent 3px), radial-gradient(circle at 88% 75%, #8cd7cf 0 2px, transparent 3px), linear-gradient(135deg, #4c397a, #1b285b)", "#edce69", "20px 5px", "#fff5d0"),
  frame("crafted_28", "Noir Paperback", "repeating-linear-gradient(135deg, #222426 0 7px, #303236 7px 14px)", "#a92835", "0 10px", "#fff8ec"),
  frame("crafted_29", "Celestial Engraving", "radial-gradient(circle at 15% 50%, #e7cf72 0 2px, transparent 3px), radial-gradient(circle at 85% 50%, #e7cf72 0 2px, transparent 3px), linear-gradient(135deg, #122553, #070d25)", "#d9bb59", "14px", "#fff4bd"),
  frame("crafted_30", "Ocean Etching", "repeating-radial-gradient(circle at 0 100%, #164d5b 0 5px, #0d3442 6px 10px)", "#7cc9c8", "18px 3px", "#eaffff"),
  frame("crafted_31", "Deco Fan", "conic-gradient(from 45deg at 50% 100%, #191b23, #8d682e, #191b23, #c8a24f, #191b23)", "#e0bc64", "2px 18px", "#fff4ce"),
  frame("crafted_32", "Sakura Paper", "radial-gradient(circle at 10% 30%, #d87394 0 3px, transparent 4px), radial-gradient(circle at 90% 70%, #c6537d 0 3px, transparent 4px), linear-gradient(135deg, #fff1f4, #e7b8c8)", "#ad476a", "19px 6px", "#542033"),
  frame("crafted_33", "Copper Rivets", "radial-gradient(circle at 6% 50%, #e5a56f 0 3px, #6d351f 4px, transparent 5px), radial-gradient(circle at 94% 50%, #e5a56f 0 3px, #6d351f 4px, transparent 5px), linear-gradient(135deg, #753b24, #2f1812)", "#c97a4e", "5px", "#fff0df"),
  frame("crafted_34", "Frost Filigree", "repeating-linear-gradient(135deg, #e9f7fb 0 7px, #b8d9e6 7px 14px)", "#6e9fb5", "6px 20px", "#173949"),
  frame("crafted_35", "Comic Halftone", "radial-gradient(circle, #17191e 0 2px, transparent 2.5px), linear-gradient(135deg, #f2d34f, #d64b45)", "#17191e", "3px 12px", "#17191e")
];

export function getChoiceButtonFrameStyle(
  frameId: string,
  opacity = 1
): CSSProperties {
  const frameStyle = CHOICE_BUTTON_FRAMES.find((candidate) => candidate.id === frameId);
  if (!frameStyle) return {};
  const normalizedOpacity = Math.max(0, Math.min(1, opacity));

  if (normalizedOpacity <= 0) {
    return {
      background: "transparent",
      border: 0,
      boxShadow: "none",
      color: frameStyle.color
    };
  }

  return {
    background: applyColorOpacity(frameStyle.background, normalizedOpacity),
    border: `2px solid ${applyColorOpacity(
      frameStyle.border,
      Math.min(1, Math.max(0.12, normalizedOpacity))
    )}`,
    borderRadius: frameStyle.borderRadius,
    boxShadow: [
      `inset 0 0 0 1px ${applyColorOpacity(frameStyle.border, 0.42)}`,
      `inset 0 7px 14px ${applyColorOpacity("#ffffff", 0.12 * normalizedOpacity)}`,
      `0 4px 10px ${applyColorOpacity("#000000", 0.22 * normalizedOpacity)}`
    ].join(", "),
    color: frameStyle.color
  };
}

function frame(
  id: string,
  label: string,
  background: string,
  border: string,
  borderRadius: string,
  color: string
): ChoiceButtonFrame {
  return {
    id,
    label,
    background,
    border,
    borderRadius,
    color
  };
}
