/**
 * Maps legacy paths (before the super-app `/kokugo` prefix) to new locations.
 * Returns null when this path is not a known legacy 国語 route.
 */
export function legacyKokugoTarget(pathname: string): string | null {
  if (pathname === "/history" || pathname === "/scan") return "/kokugo/prints";
  if (pathname.startsWith("/prints")) {
    const tail = pathname.slice("/prints".length);
    return "/kokugo/prints" + tail;
  }
  if (pathname.startsWith("/exercise/")) return `/kokugo${pathname}`;
  if (pathname.startsWith("/result/")) return `/kokugo${pathname}`;
  if (pathname === "/remind" || pathname.startsWith("/remind/")) return `/kokugo${pathname}`;
  if (pathname === "/settings" || pathname.startsWith("/settings/")) return `/kokugo${pathname}`;
  return null;
}
