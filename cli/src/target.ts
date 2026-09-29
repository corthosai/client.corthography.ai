/** Target string normalization.
 *
 * Canonical form: `{owner}/{collection}/{type}/{name}+{project_slug}`.
 *
 * From inside a partner repo, the owner is implicit. This helper accepts a
 * 3-segment shorthand (`{collection}/{type}/{name}+{project_slug}`) and
 * prepends the configured owner so partners don't have to repeat it.
 *
 * A 3-segment path is ambiguous: it can be that owner-implicit shorthand OR a
 * full owner/collection/type **root-collection** template (e.g.
 * `mf/college-factual/majors`, whose overview lives at the collection root with
 * no `…/name` segment — the API supports these). We resolve it by the FIRST
 * segment (#29):
 *   - no owner configured → nothing to prepend; already-complete root slug.
 *   - first segment IS the configured owner → already owner-qualified root slug;
 *     pass through (prepending here produced `mf/mf/…` → 403 ScopeViolation).
 *   - otherwise → shorthand `{collection}/{type}/{name}`; prepend the owner.
 * Edge case: if a collection shares its owner's name, its 3-segment shorthand
 * reads as owner-qualified — use the full form (`{owner}/{collection}/…`, 4+
 * segments), which always passes through.
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

  // Full form already carries the owner as the first segment. Template paths can
  // be deeper than {owner}/{collection}/{type}/{name} (e.g. majors/rankings/top-ranked
  // or colleges/paying-for-college/tuition-and-fees), so accept any depth >= 4.
  if (segments.length >= 4) {
    return target;
  }
  // 3 segments: an already-complete {owner}/{collection}/{type} root-collection
  // slug (e.g. mf/college-factual/majors) when there is no owner to prepend or
  // when it already starts with the configured owner; otherwise the
  // owner-implicit shorthand {collection}/{type}/{name} — prepend the owner.
  if (segments.length === 3) {
    if (!opts.owner || segments[0] === opts.owner) {
      return target;
    }
    return `${opts.owner}/${segments.join("/")}${suffix}`;
  }

  throw new Error(
    `target "${target}" must be {owner}/{collection}/{type}/{name}[+{project_slug}] ` +
      `(got ${segments.length} path segments before "+").`,
  );
}
