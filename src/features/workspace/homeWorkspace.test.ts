import { beforeEach, describe, expect, it, vi } from "vitest";
import { listHomeProjects, listRecentHomeProjects } from "./homeWorkspace";

function makeStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
  };
}

describe("home workspace project listing", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", makeStorage());

    localStorage.setItem(
      "aicanvas_workspace_v2",
      JSON.stringify({
        version: 2,
        currentId: "wf_3",
        workflows: {
          wf_1: {
            summary: { id: "wf_1", name: "项目 1", tags: [], createdAt: 1, updatedAt: 10 },
            data: { nodes: [], links: [], nodeOutputs: [] },
          },
          wf_2: {
            summary: { id: "wf_2", name: "项目 2", tags: [], createdAt: 2, updatedAt: 20 },
            data: { nodes: [], links: [], nodeOutputs: [] },
          },
          wf_3: {
            summary: { id: "wf_3", name: "项目 3", tags: [], createdAt: 3, updatedAt: 30 },
            data: { nodes: [], links: [], nodeOutputs: [] },
          },
        },
        trash: [],
      })
    );
  });

  it("lists all projects sorted by most recently updated", () => {
    expect(listHomeProjects().map((project) => project.name)).toEqual(["项目 3", "项目 2", "项目 1"]);
  });

  it("keeps recent projects capped by the requested limit", () => {
    expect(listRecentHomeProjects(2).map((project) => project.name)).toEqual(["项目 3", "项目 2"]);
  });
});
