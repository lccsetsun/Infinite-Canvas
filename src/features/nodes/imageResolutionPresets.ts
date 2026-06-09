export type ImageResolution = "1K" | "2K" | "3K" | "4K";
export type ImageAspectRatio = "1:1" | "4:3" | "3:4" | "16:9" | "9:16" | "3:2" | "2:3" | "21:9";

export interface ImageResolutionPreset {
  resolution: ImageResolution;
  aspectRatio: ImageAspectRatio;
  width: number;
  height: number;
}

export interface ImageResolutionPresetGroup {
  resolution: ImageResolution;
  presets: ImageResolutionPreset[];
}

export const IMAGE_RESOLUTION_PRESET_GROUPS: ImageResolutionPresetGroup[] = [
  {
    resolution: "1K",
    presets: [
      { resolution: "1K", aspectRatio: "1:1", width: 1024, height: 1024 },
      { resolution: "1K", aspectRatio: "4:3", width: 1152, height: 864 },
      { resolution: "1K", aspectRatio: "3:4", width: 864, height: 1152 },
      { resolution: "1K", aspectRatio: "16:9", width: 1408, height: 792 },
      { resolution: "1K", aspectRatio: "9:16", width: 792, height: 1408 },
      { resolution: "1K", aspectRatio: "3:2", width: 1248, height: 832 },
      { resolution: "1K", aspectRatio: "2:3", width: 832, height: 1248 },
      { resolution: "1K", aspectRatio: "21:9", width: 1568, height: 672 },
    ],
  },
  {
    resolution: "2K",
    presets: [
      { resolution: "2K", aspectRatio: "1:1", width: 2048, height: 2048 },
      { resolution: "2K", aspectRatio: "4:3", width: 2304, height: 1728 },
      { resolution: "2K", aspectRatio: "3:4", width: 1728, height: 2304 },
      { resolution: "2K", aspectRatio: "16:9", width: 2848, height: 1600 },
      { resolution: "2K", aspectRatio: "9:16", width: 1600, height: 2848 },
      { resolution: "2K", aspectRatio: "3:2", width: 2496, height: 1664 },
      { resolution: "2K", aspectRatio: "2:3", width: 1664, height: 2496 },
      { resolution: "2K", aspectRatio: "21:9", width: 3136, height: 1344 },
    ],
  },
  {
    resolution: "3K",
    presets: [
      { resolution: "3K", aspectRatio: "1:1", width: 3072, height: 3072 },
      { resolution: "3K", aspectRatio: "4:3", width: 3456, height: 2592 },
      { resolution: "3K", aspectRatio: "3:4", width: 2592, height: 3456 },
      { resolution: "3K", aspectRatio: "16:9", width: 4096, height: 2304 },
      { resolution: "3K", aspectRatio: "9:16", width: 2304, height: 4096 },
      { resolution: "3K", aspectRatio: "2:3", width: 2496, height: 3744 },
      { resolution: "3K", aspectRatio: "3:2", width: 3744, height: 2496 },
      { resolution: "3K", aspectRatio: "21:9", width: 4704, height: 2016 },
    ],
  },
  {
    resolution: "4K",
    presets: [
      { resolution: "4K", aspectRatio: "1:1", width: 4096, height: 4096 },
      { resolution: "4K", aspectRatio: "3:4", width: 3520, height: 4704 },
      { resolution: "4K", aspectRatio: "4:3", width: 4704, height: 3520 },
      { resolution: "4K", aspectRatio: "16:9", width: 5504, height: 3040 },
      { resolution: "4K", aspectRatio: "9:16", width: 3040, height: 5504 },
      { resolution: "4K", aspectRatio: "2:3", width: 3328, height: 4992 },
      { resolution: "4K", aspectRatio: "3:2", width: 4992, height: 3328 },
      { resolution: "4K", aspectRatio: "21:9", width: 6240, height: 2656 },
    ],
  },
];

export const IMAGE_RESOLUTION_PRESETS = IMAGE_RESOLUTION_PRESET_GROUPS.flatMap(
  (group) => group.presets
);

export const IMAGE_RESOLUTION_OPTIONS = IMAGE_RESOLUTION_PRESET_GROUPS.map(
  (group) => group.resolution
);

export const IMAGE_ASPECT_RATIO_OPTIONS = Array.from(
  new Set(IMAGE_RESOLUTION_PRESETS.map((preset) => preset.aspectRatio))
);

export function getImageResolutionPreset(
  resolution: string,
  aspectRatio: string
): ImageResolutionPreset | undefined {
  return IMAGE_RESOLUTION_PRESETS.find(
    (preset) => preset.resolution === resolution && preset.aspectRatio === aspectRatio
  );
}

export function getFallbackImageResolutionPreset() {
  return getImageResolutionPreset("1K", "16:9") ?? IMAGE_RESOLUTION_PRESETS[0];
}

export function formatImageResolutionPreset(resolution: string, aspectRatio: string) {
  const preset = getImageResolutionPreset(resolution, aspectRatio) ?? getFallbackImageResolutionPreset();
  return `${preset.aspectRatio} · ${preset.width}×${preset.height}`;
}

export function formatImageResolutionPresetOption(resolution: string, aspectRatio: string) {
  const preset = getImageResolutionPreset(resolution, aspectRatio) ?? getFallbackImageResolutionPreset();
  return `${preset.resolution} ${preset.aspectRatio} · ${preset.width}×${preset.height}`;
}
