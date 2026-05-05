/** Target string normalization.
 *
 * Canonical form: `{owner}/{collection}/{type}/{name}+{project_slug}`.
 *
 * From inside a partner repo, the owner is implicit. This helper accepts a
 * 3-segment shorthand (`{collection}/{type}/{name}+{project_slug}`) and
 * prepends the configured owner so partners don't have to repeat it.
 */

export interface ResolveTargetOptions {
  owner?: string;
}

export function resolveTarget(rawTarget: string, opts: ResolveTargetOptions = {}): string {
  const target = rawTarget.trim();
  if (!target) {
    throw new Error("target is required");
  }

  const plus = target.indexOf("+");
  const path = plus >= 0 ? target.slice(0, plus) : target;
  const suffix = plus >= 0 ? target.slice(plus) : "";
  const segments = path.split("/").filter(Boolean);

  if (segments.length === 4) {
    return target;
  }
  if (segments.length === 3) {
    if (!opts.owner) {
      throw new Error(
        `target "${target}" is missing the owner segment. ` +
          "Either prepend the owner (e.g., dms/...) or set CORTHOGRAPHY_OWNER " +
          "(env var or .fractary/env/.env.<env>).",
      );
    }
    return `${opts.owner}/${segments.join("/")}${suffix}`;
  }

  throw new Error(
    `target "${target}" must be {owner}/{collection}/{type}/{name}[+{project_slug}] ` +
      `(got ${segments.length} path segments before "+").`,
  );
}
