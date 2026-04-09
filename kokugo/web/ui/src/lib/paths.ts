/** URL prefixes for mini-apps inside the super app shell. */

export const KOKUGO_BASE = "/kokugo";
export const SANSU_BASE = "/sansu";

export const paths = {
  home: "/",
  sansu: {
    home: SANSU_BASE,
    prints: `${SANSU_BASE}/prints`,
    printsNew: `${SANSU_BASE}/prints/new`,
    scan: (id: string) => `${SANSU_BASE}/prints/${encodeURIComponent(id)}/scan`,
  },
  kokugo: {
    prints: `${KOKUGO_BASE}/prints`,
    printsNew: `${KOKUGO_BASE}/prints/new`,
    print: (id: string) => `${KOKUGO_BASE}/prints/${encodeURIComponent(id)}`,
    scan: (id: string) => `${KOKUGO_BASE}/prints/${encodeURIComponent(id)}/scan`,
    exercise: (id: string) => `${KOKUGO_BASE}/exercise/${encodeURIComponent(id)}`,
    result: (id: string) => `${KOKUGO_BASE}/result/${encodeURIComponent(id)}`,
    remind: `${KOKUGO_BASE}/remind`,
    settings: `${KOKUGO_BASE}/settings`,
  },
} as const;
