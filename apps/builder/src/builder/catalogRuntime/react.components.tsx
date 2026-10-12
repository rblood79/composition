import { useContext, type ReactNode } from "react";

import { WorkspaceContext } from "./react.runtime";
import type { CatalogWorkspace } from "./workspace";

export function CatalogWorkspaceProvider({
  workspace,
  children,
}: {
  workspace: CatalogWorkspace;
  children: ReactNode;
}) {
  return (
    <WorkspaceContext.Provider value={workspace}>
      {children}
    </WorkspaceContext.Provider>
  );
}

/** Renders its children only once a project is open (panels mount before the workspace exists). */
export function CatalogWorkspaceGate({ children }: { children: ReactNode }) {
  return useContext(WorkspaceContext) ? <>{children}</> : null;
}
