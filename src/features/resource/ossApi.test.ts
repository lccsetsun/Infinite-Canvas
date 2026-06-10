import { describe, expect, it, vi } from "vitest";
import { devApiFetch } from "../auth/request";
import { uploadFileToOss } from "./ossApi";

vi.mock("../auth/request", () => ({
  devApiFetch: vi.fn(),
}));

describe("uploadFileToOss", () => {
  it("keeps the OSS id returned by the upload API", async () => {
    vi.mocked(devApiFetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          code: 200,
          msg: "ok",
          data: {
            fileName: "image.webp",
            ossId: "2064712536372035585",
            url: "https://example.com/image.webp",
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    const result = await uploadFileToOss(new File(["demo"], "image.webp", { type: "image/webp" }));

    expect(result).toMatchObject({
      url: "https://example.com/image.webp",
      ossId: "2064712536372035585",
      fileName: "image.webp",
    });
  });
});
