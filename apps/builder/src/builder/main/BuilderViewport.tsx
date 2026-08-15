import React from "react";
import { ContextMenuProvider } from "../components";

export interface BuilderViewportProps {
  children: React.ReactNode;
  className?: string;
}

export const BuilderViewport: React.FC<BuilderViewportProps> = ({
  children,
  className = "app",
}) => {
  return (
    <div className={className} data-context="builder">
      <ContextMenuProvider>{children}</ContextMenuProvider>
    </div>
  );
};
