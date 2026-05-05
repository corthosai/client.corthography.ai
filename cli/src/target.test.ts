import { describe, expect, it } from "vitest";
import { resolveTarget } from "./target.js";

describe("resolveTarget", () => {
  it("passes 4-segment targets through unchanged", () => {
    expect(resolveTarget("dms/education-niche/colleges/overview+computer-science-degree")).toBe(
      "dms/education-niche/colleges/overview+computer-science-degree",
    );
  });

  it("prepends owner to 3-segment targets", () => {
    expect(
      resolveTarget("education-niche/colleges/overview+computer-science-degree", { owner: "dms" }),
    ).toBe("dms/education-niche/colleges/overview+computer-science-degree");
  });

  it("4-segment targets ignore configured owner", () => {
    expect(
      resolveTarget("mf/some/other/template+slug", { owner: "dms" }),
    ).toBe("mf/some/other/template+slug");
  });

  it("works without a project_slug suffix", () => {
    expect(resolveTarget("education-niche/colleges/overview", { owner: "dms" })).toBe(
      "dms/education-niche/colleges/overview",
    );
  });

  it("errors clearly when 3 segments and no owner is configured", () => {
    expect(() => resolveTarget("education-niche/colleges/overview+slug")).toThrow(
      /missing the owner segment/,
    );
  });

  it("errors when path has the wrong number of segments", () => {
    expect(() => resolveTarget("a/b+slug", { owner: "dms" })).toThrow(/path segments/);
    expect(() => resolveTarget("a/b/c/d/e+slug", { owner: "dms" })).toThrow(/path segments/);
  });

  it("errors on empty target", () => {
    expect(() => resolveTarget("")).toThrow(/required/);
    expect(() => resolveTarget("   ")).toThrow(/required/);
  });
});
