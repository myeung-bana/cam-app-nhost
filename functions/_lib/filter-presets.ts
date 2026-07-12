export interface FilterPreset {
  id: string;
  label: string;
  css: string;
  sharp?: {
    modulate?: { saturation?: number; brightness?: number };
    tint?: string;
    greyscale?: boolean;
    sepia?: boolean;
  };
}

export const FILTER_PRESETS: FilterPreset[] = [
  { id: "none", label: "Original", css: "" },
  {
    id: "warm",
    label: "Warm",
    css: "sepia(0.3) saturate(1.4)",
    sharp: { sepia: true, modulate: { saturation: 1.4 } },
  },
  {
    id: "mono",
    label: "Mono",
    css: "grayscale(1) contrast(1.1)",
    sharp: { greyscale: true, modulate: { brightness: 1.05 } },
  },
  {
    id: "fade",
    label: "Fade",
    css: "opacity(0.85) brightness(1.1) saturate(0.8)",
    sharp: { modulate: { brightness: 1.1, saturation: 0.8 } },
  },
  {
    id: "vivid",
    label: "Vivid",
    css: "saturate(1.8) contrast(1.1)",
    sharp: { modulate: { saturation: 1.8, brightness: 1.02 } },
  },
];

export function getFilterPreset(id: string | null | undefined): FilterPreset {
  if (!id) return FILTER_PRESETS[0];
  return FILTER_PRESETS.find((preset) => preset.id === id) ?? FILTER_PRESETS[0];
}
