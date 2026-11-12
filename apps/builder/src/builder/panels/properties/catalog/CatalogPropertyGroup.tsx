import type { ReactNode } from "react";
import "./CatalogPropertyGroup.css";

/**
 * A group inside a merged Property section (사용자 결정 2026-11-12 「Property 탭 섹션 병합」): what was
 * a fixed section of its own (Item roles · Item fields · Show when · Component properties · Set by
 * variable) stands in Content · Collection · Behavior · State under its old name as a legend — no
 * collapsible header of its own.
 */
export function CatalogPropertyGroup({
  title,
  group,
  children,
}: {
  title: string;
  /** `data-property-group` — the group's role (tests · live checks read it). */
  group: string;
  children: ReactNode;
}) {
  return (
    <fieldset
      className="properties-aria property-group"
      data-property-group={group}
    >
      <legend className="fieldset-legend">{title}</legend>
      {children}
    </fieldset>
  );
}
