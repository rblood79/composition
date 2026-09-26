import { subscribeAssetUrls } from "@composition/shared/utils";
import {
  FONT_REGISTRY_STORAGE_KEY,
  injectRegistryFontStyle,
  loadFontRegistry,
  saveRegistryAndNotify,
} from "./customFonts";
import { isAssetWriterEnabled } from "../../utils/featureFlags";

/** ADR-235 R7 — 이관 전 원본 레지스트리 (자산으로 백업) 참조. GC root (Phase 3). */
export const FONT_REGISTRY_BACKUP_REF_KEY =
  "composition.font-registry.backup-ref";

if (typeof window !== "undefined" && typeof document !== "undefined") {
  injectRegistryFontStyle();

  window.addEventListener("storage", (event) => {
    if (event.key !== FONT_REGISTRY_STORAGE_KEY) return;
    injectRegistryFontStyle();
  });

  window.addEventListener("composition:custom-fonts-updated", () => {
    injectRegistryFontStyle();
  });

  // ADR-235 — 준비 전 `asset:` face 는 CSS 에서 빠진다. 준비되면 다시 주입한다.
  subscribeAssetUrls(() => injectRegistryFontStyle());

  // ADR-235 Phase 2 — 레지스트리의 base64 폰트를 자산 저장소로 (1회 · 멱등, 원본은 자산으로 백업).
  if (
    isAssetWriterEnabled() &&
    localStorage.getItem(FONT_REGISTRY_STORAGE_KEY)?.includes("data:")
  ) {
    void import("../../lib/assets/assetMigration").then(
      ({ migrateFontRegistry }) =>
        migrateFontRegistry({
          load: loadFontRegistry,
          save: saveRegistryAndNotify,
          readRaw: () => localStorage.getItem(FONT_REGISTRY_STORAGE_KEY),
          writeBackupRef: (ref) =>
            localStorage.setItem(FONT_REGISTRY_BACKUP_REF_KEY, ref),
        }),
    );
  }
}
