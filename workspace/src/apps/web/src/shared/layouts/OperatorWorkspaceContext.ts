import { createContext, useContext } from "react";

export const OperatorWorkspaceContext = createContext(false);
export const useOperatorWorkspace = (): boolean =>
  useContext(OperatorWorkspaceContext);
