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

  it("passes deep (>=4 segment) full targets through unchanged", () => {
    // Template paths can be deeper than {owner}/{collection}/{type}/{name},
    // e.g. majors/rankings/top-ranked or colleges/paying-for-college/tuition-and-fees.
    expect(
      resolveTarget("mf/college-factual/majors/rankings/top-ranked+college-factual", {
        owner: "mf",
      }),
    ).toBe("mf/college-factual/majors/rankings/top-ranked+college-factual");
    expect(
      resolveTarget("mf/college-factual/colleges/paying-for-college/tuition-and-fees+college-factual"),
    ).toBe("mf/college-factual/colleges/paying-for-college/tuition-and-fees+college-factual");
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

  it("errors when path has too few segments", () => {
    expect(() => resolveTarget("a/b+slug", { owner: "dms" })).toThrow(/path segments/);
  });

  it("errors on empty target", () => {
    expect(() => resolveTarget("")).toThrow(/required/);
    expect(() => resolveTarget("   ")).toThrow(/required/);
  });
});
