import {
  buildRegistryFontFaceCss,
  FONT_REGISTRY_STORAGE_KEY,
  loadFontRegistry,
  resolveAssetUrl,
  subscribeAssetUrls,
} from "@composition/shared";

/**
 * 커스텀 폰트 @font-face CSS를 DOM에 주입합니다.
 * localStorage의 FontRegistry에서 읽어옵니다 — 주입할 때마다 다시 읽는다. Builder 가 폰트를
 * 올리거나 지우면 (같은 origin 의 다른 window) storage 이벤트가 오고, Builder 의
 * `composition:custom-fonts-updated` 는 같은 window 전용이라 iframe 에 닿지 않는다.
 */
export function injectPreviewCustomFonts(): void {
  try {
    const style = document.createElement("style");
    style.id = "preview-custom-fonts";
    document.head.appendChild(style);
    const apply = () => {
      style.textContent = buildRegistryFontFaceCss(
        loadFontRegistry(),
        resolveAssetUrl,
      );
    };
    apply();
    // ADR-235 — `asset:` 폰트는 준비되면 다시 주입 (준비 전 face 는 건너뛴다)
    subscribeAssetUrls(apply);
    window.addEventListener("storage", (event) => {
      if (event.key === FONT_REGISTRY_STORAGE_KEY || event.key === null)
        apply();
    });
  } catch {
    // FontRegistry 없으면 무시
  }
}
