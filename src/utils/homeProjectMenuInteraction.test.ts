import { describe, expect, it } from "vitest";
import { isHomeProjectMenuInteractionInside } from "./homeProjectMenuInteraction";

describe("isHomeProjectMenuInteractionInside", () => {
  it("treats clicks inside either the host or portal menu as internal", () => {
    const hostChild = { id: "host-child" };
    const portalChild = { id: "portal-child" };
    const host = {
      contains(target: unknown) {
        return target === hostChild;
      },
    };
    const portal = {
      contains(target: unknown) {
        return target === portalChild;
      },
    };

    expect(isHomeProjectMenuInteractionInside(hostChild as unknown as EventTarget, [host, portal])).toBe(true);
    expect(isHomeProjectMenuInteractionInside(portalChild as unknown as EventTarget, [host, portal])).toBe(true);
  });

  it("treats outside clicks as external", () => {
    const host = {
      contains() {
        return false;
      },
    };
    const portal = {
      contains() {
        return false;
      },
    };
    const outside = { id: "outside" };

    expect(isHomeProjectMenuInteractionInside(outside as unknown as EventTarget, [host, portal])).toBe(false);
  });
});
