import { describe, expect, it } from "vitest";
import { createNodeFromType } from "./nodeFactory";

describe("createNodeFromType", () => {
  it("creates image nodes with text, image, audio, and video inputs", () => {
    const node = createNodeFromType("image_node", "image-1", 0, 0);

    expect(node.inputs).toEqual([
      { name: "source_image", type: "IMAGE" },
      { name: "prompt", type: "STRING" },
      { name: "negative_prompt", type: "STRING" },
      { name: "aspect_ratio", type: "STRING" },
      { name: "source_audio", type: "AUDIO" },
      { name: "source_video", type: "VIDEO" },
    ]);
  });

  it("creates audio nodes with text, image, and audio inputs", () => {
    const node = createNodeFromType("audio_node", "audio-1", 0, 0);

    expect(node.inputs).toEqual([
      { name: "提示词", type: "STRING" },
      { name: "时长", type: "NUMBER" },
      { name: "source_image", type: "IMAGE" },
      { name: "source_audio", type: "AUDIO" },
    ]);
  });
});
