import { subscribeAssetUrls } from "@composition/shared/utils";
import {
  FONT_REGISTRY_STORAGE_KEY,
  injectRegistryFontStyle,
} from "./customFonts";

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
}
