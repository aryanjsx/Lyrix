import { createContext, useContext } from "react";
import { useDataSaver, type DataMode } from "@/hooks/useDataSaver";

const DataModeContext = createContext<DataMode>("full");

export function DataModeProvider({ children }: { children: React.ReactNode }) {
  const mode = useDataSaver();
  return (
    <DataModeContext.Provider value={mode}>
      {children}
    </DataModeContext.Provider>
  );
}

export const useDataMode = () => useContext(DataModeContext);
