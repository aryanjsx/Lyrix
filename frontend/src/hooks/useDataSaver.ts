import { useEffect, useState } from "react";

export type DataMode = "full" | "reduced" | "minimal";

export function useDataSaver(): DataMode {
  const [mode, setMode] = useState<DataMode>("full");

  useEffect(() => {
    function evaluate() {
      const conn = (navigator as unknown as { connection?: { effectiveType?: string; saveData?: boolean } }).connection;
      if (!conn) return;

      const type = conn.effectiveType ?? "";
      const saveData = conn.saveData ?? false;

      if (saveData || type === "2g" || type === "slow-2g") {
        setMode("minimal");
      } else if (type === "3g") {
        setMode("reduced");
      } else {
        setMode("full");
      }
    }

    evaluate();
    const conn = (navigator as unknown as { connection?: EventTarget }).connection;
    conn?.addEventListener("change", evaluate);
    return () => conn?.removeEventListener("change", evaluate);
  }, []);

  return mode;
}
