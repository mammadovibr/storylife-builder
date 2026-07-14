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
  frame("crafted_20", "Ink Wash", "linear-gradient(135deg, #f4f1e8, #b8b4a9)", "#36383d", "0 14px", "#202226")
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
