import { useEffect, useSyncExternalStore } from "react";
import { Crosshair } from "lucide-react";
import { useI18n } from "@/i18n";
import {
  useCatalogSession,
  useCatalogWorkspace,
} from "../../../catalogRuntime/react";
import type { CatalogCanvasTargetPick } from "../../../catalogRuntime/targetPick";
import { formatShortcut } from "../../../hooks/useKeyboardShortcutsRegistry";
import "./CatalogTargetPickOverlay.css";

/** The tag the pointer carries while picking a rule's target (screen px in the canvas box). */
export interface CatalogTargetPickTag {
  x: number;
  y: number;
  pick: CatalogCanvasTargetPick;
}
let tag: CatalogTargetPickTag | undefined;
const listeners = new Set<() => void>();
/** The Canvas pointer handlers set it (no React state on pointer moves); `undefined` hides it. */
export function setCatalogTargetPickTag(
  next: CatalogTargetPickTag | undefined,
) {
  if (next === tag) return;
  tag = next;
  for (const listener of [...listeners]) listener();
}
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/**
 * ADR-283 Decision 5 — the Canvas target pick's banner (「대상으로 쓸 요소를 클릭 · Esc」) and the
 * pointer's tag (`type · name · #id4`; a raised part shows both names — 「Input → TextField」).
 */
export function CatalogTargetPickOverlay() {
  const { t } = useI18n();
  const picking = useCatalogSession((state) => !!state.targetPick);
  const current = useSyncExternalStore(subscribe, () => tag);
  const workspace = useCatalogWorkspace();
  // A press outside the Canvas (another panel) ends the pick — the aim button toggles it itself.
  useEffect(() => {
    if (!picking) return;
    const onPress = (event: PointerEvent) => {
      const element = event.target as Element | null;
      if (
        element?.closest(".canvas-container") ||
        element?.closest(".interactions-target-aim")
      )
        return;
      workspace.session.setTargetPick(undefined);
      setCatalogTargetPickTag(undefined);
    };
    window.addEventListener("pointerdown", onPress, true);
    return () => window.removeEventListener("pointerdown", onPress, true);
  }, [picking, workspace]);
  if (!picking) return null;
  const pick = current?.pick;
  const label = pick
    ? [pick.type, pick.name, pick.htmlId ? `#${pick.htmlId}` : pick.shortId]
        .filter(Boolean)
        .join(" · ")
    : undefined;
  return (
    <>
      <div className="catalog-target-pick-banner" role="status">
        <Crosshair aria-hidden="true" size={14} />
        {t("interactions.targetPickBanner")}
        {" · "}
        {t("interactions.targetPickDeep", {
          key: formatShortcut({ key: "", modifier: "cmd" }),
        })}
      </div>
      {current && pick && (
        <div
          className="catalog-target-pick-tag"
          style={{ left: current.x + 12, top: current.y + 12 }}
          data-unavailable={!pick.capable || !pick.write || undefined}
        >
          {pick.raisedFrom
            ? t("interactions.targetPickOwner", {
                part: pick.raisedFrom,
                owner: label ?? "",
              })
            : label}
          {!pick.capable && ` — ${t("interactions.targetPickNoCapability")}`}
        </div>
      )}
    </>
  );
}
