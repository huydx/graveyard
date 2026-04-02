import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

const STORAGE_KEY = "kokugoDraftExerciseId";

type Ctx = {
  draftExerciseId: string | null;
  setDraftExerciseId: (id: string | null) => void;
  /** Clears the in-progress scan (session storage + state). Call from「新しいスキャン」before /scan. */
  beginNewScan: () => void;
};

const DraftExerciseContext = createContext<Ctx | null>(null);

export function DraftExerciseProvider({ children }: { children: ReactNode }) {
  const [draftExerciseId, setState] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem(STORAGE_KEY);
    } catch {
      return null;
    }
  });

  const setDraftExerciseId = useCallback((id: string | null) => {
    setState(id);
    try {
      if (id) sessionStorage.setItem(STORAGE_KEY, id);
      else sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  const beginNewScan = useCallback(() => {
    setDraftExerciseId(null);
  }, [setDraftExerciseId]);

  const value = useMemo(
    () => ({ draftExerciseId, setDraftExerciseId, beginNewScan }),
    [draftExerciseId, setDraftExerciseId, beginNewScan]
  );

  return <DraftExerciseContext.Provider value={value}>{children}</DraftExerciseContext.Provider>;
}

export function useDraftExercise() {
  const v = useContext(DraftExerciseContext);
  if (!v) throw new Error("useDraftExercise outside provider");
  return v;
}
