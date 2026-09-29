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

  it("treats a 3-segment path as a full owner/collection/type root slug when no owner is configured", () => {
    // Root-collection templates (overview at the collection root, no /name segment),
    // e.g. mf/college-factual/majors — the API supports these. With no owner to
    // prepend, the path is already complete and passes through unchanged.
    expect(resolveTarget("mf/college-factual/majors+college-factual")).toBe(
      "mf/college-factual/majors+college-factual",
    );
    expect(resolveTarget("mf/college-factual/majors")).toBe("mf/college-factual/majors");
  });

  it("passes an owner-qualified 3-segment root slug through when the owner is configured (#29)", () => {
    // Previously prepended the owner again → mf/mf/college-factual/careers → 403.
    expect(resolveTarget("mf/college-factual/careers+college-factual", { owner: "mf" })).toBe(
      "mf/college-factual/careers+college-factual",
    );
    expect(resolveTarget("dms/education/colleges+computer-science-degree", { owner: "dms" })).toBe(
      "dms/education/colleges+computer-science-degree",
    );
    expect(resolveTarget("mf/college-factual/majors", { owner: "mf" })).toBe(
      "mf/college-factual/majors",
    );
  });

  it("still prepends when the first segment is a different owner's name", () => {
    // Only the CONFIGURED owner marks a path as qualified; anything else is shorthand.
    expect(resolveTarget("mf/college-factual/careers+college-factual", { owner: "dms" })).toBe(
      "dms/mf/college-factual/careers+college-factual",
    );
  });

  it("trims whitespace around an owner-qualified 3-segment target", () => {
    expect(resolveTarget("  dms/education/colleges+computer-science-degree  ", { owner: "dms" })).toBe(
      "dms/education/colleges+computer-science-degree",
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
