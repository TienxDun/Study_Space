import { describe, it, expect } from "vitest";
import { APP_VERSION, APP_VERSION_LABEL } from "@/lib/version";

describe("Study Space App Version", () => {
  it("exports valid SemVer version string", () => {
    expect(APP_VERSION).toBe("0.1.0");
    expect(APP_VERSION_LABEL).toBe("v0.1.0");
  });

  it("follows vX.Y.Z format", () => {
    expect(APP_VERSION_LABEL).toMatch(/^v\d+\.\d+\.\d+$/);
  });
});
