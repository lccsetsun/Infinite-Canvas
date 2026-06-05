import { afterEach, describe, expect, it, vi } from "vitest";
import {
  API_SETTINGS_STORAGE_KEY,
  PROVIDER_ORDER,
  PROVIDER_PRESETS,
  loadApiSettings,
  makeDefaultProfile,
  makeDefaultSettings,
  selectProviderProfile,
  testConnection,
} from "./apiSettings";

describe("api provider presets", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("only exposes DeepSeek and MiniMax", () => {
    expect(PROVIDER_ORDER).toEqual(["deepseek", "minimax"]);
    expect(Object.keys(PROVIDER_PRESETS)).toEqual(["deepseek", "minimax"]);
  });

  it("configures MiniMax image, video, and audio defaults", async () => {
    expect(PROVIDER_PRESETS.minimax).toMatchObject({
      baseUrl: "https://api.minimaxi.com/v1",
      defaultModel: "image-01",
      models: ["image-01", "MiniMax-M3", "MiniMax-Hailuo-2.3", "speech-2.8-hd"],
    });

    await expect(
      testConnection({
        id: "api_minimax",
        name: "MiniMax",
        provider: "minimax",
        baseUrl: PROVIDER_PRESETS.minimax.baseUrl,
        apiKey: "mini-key",
        model: "image-01",
        temperature: 0.7,
        maxTokens: 2048,
        topP: 1,
        timeout: 60,
        systemPrompt: "",
        useSystemProxy: false,
        createdAt: 0,
        updatedAt: 0,
      })
    ).resolves.toMatchObject({
      ok: true,
      models: ["image-01", "MiniMax-M3", "MiniMax-Hailuo-2.3", "speech-2.8-hd"],
    });
  });

  it("creates both DeepSeek and MiniMax profiles by default", () => {
    const settings = makeDefaultSettings();
    expect(settings.profiles.map((profile) => profile.provider)).toEqual(["deepseek", "minimax"]);
    expect(settings.profiles.find((profile) => profile.provider === "minimax")).toMatchObject({
      name: "MiniMax",
      baseUrl: "https://api.minimaxi.com/v1",
      model: "image-01",
      apiKey: "",
    });
  });

  it("keeps DeepSeek and MiniMax API keys in separate profiles", () => {
    const deepseek = {
      ...makeDefaultProfile(),
      id: "deepseek_profile",
      apiKey: "sk-deepseek",
    };
    const initial = {
      profiles: [deepseek],
      activeProfileId: deepseek.id,
      autoTestOnSave: false,
    };

    const withMiniMax = selectProviderProfile(initial, "minimax");
    const minimax = withMiniMax.profiles.find((profile) => profile.provider === "minimax");
    expect(minimax).toBeTruthy();
    expect(minimax?.apiKey).toBe("");

    const editedMiniMax = {
      ...withMiniMax,
      profiles: withMiniMax.profiles.map((profile) =>
        profile.id === withMiniMax.activeProfileId ? { ...profile, apiKey: "mini-key" } : profile
      ),
    };
    const backToDeepSeek = selectProviderProfile(editedMiniMax, "deepseek");

    expect(backToDeepSeek.activeProfileId).toBe("deepseek_profile");
    expect(backToDeepSeek.profiles.find((profile) => profile.provider === "deepseek")?.apiKey).toBe("sk-deepseek");
    expect(backToDeepSeek.profiles.find((profile) => profile.provider === "minimax")?.apiKey).toBe("mini-key");
  });

  it("migrates old MiniMax international base URL to the China endpoint", () => {
    const deepseek = { ...makeDefaultProfile(), id: "deepseek_profile" };
    const minimax = {
      ...makeDefaultProfile(),
      id: "minimax_profile",
      name: "MiniMax",
      provider: "minimax" as const,
      baseUrl: "https://api.minimax.io/v1",
      model: "image-01",
    };

    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => store.set(key, value),
    });

    localStorage.setItem(
      API_SETTINGS_STORAGE_KEY,
      JSON.stringify({
        profiles: [deepseek, minimax],
        activeProfileId: minimax.id,
        autoTestOnSave: false,
      })
    );

    expect(loadApiSettings().profiles.find((profile) => profile.provider === "minimax")?.baseUrl).toBe(
      "https://api.minimaxi.com/v1"
    );
  });

  it("migrates the old invalid DeepSeek flash model to deepseek-chat", () => {
    const deepseek = {
      ...makeDefaultProfile(),
      id: "deepseek_profile",
      model: "deepseek-v4-flash",
    };

    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => store.set(key, value),
    });

    localStorage.setItem(
      API_SETTINGS_STORAGE_KEY,
      JSON.stringify({
        profiles: [deepseek],
        activeProfileId: deepseek.id,
        autoTestOnSave: false,
      })
    );

    expect(loadApiSettings().profiles.find((profile) => profile.provider === "deepseek")?.model).toBe("deepseek-chat");
  });
});
