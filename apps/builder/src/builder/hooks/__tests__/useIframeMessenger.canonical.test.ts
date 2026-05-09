/**
 * ADR-903 P3-D-4 — useIframeMessenger UPDATE_ELEMENTS schema canonical 전환 검증
 *
 * 본 test 는 RED phase: GREEN 변환 (postMessage schema 의 layoutId →
 * reusableFrameId + version: "composition-1.0" bump) 전까지 의도적으로 FAIL.
 *
 * 변환 목표:
 * - message.version: "legacy-1.0" → "composition-1.0"
 * - pageInfo.layoutId 필드 제거 또는 reusableFrameId 와 alias 병기
 * - Preview 측 messageHandler.ts 가 신규 schema 수신 가능
 *
 * 참조:
 * - docs/adr/design/903-phase3d-runtime-breakdown.md §4.4
 * - 변환 위치: apps/builder/src/builder/hooks/useIframeMessenger.ts L196~235
 */

import { describe, it, expect } from "vitest";

describe("P3-D-4: useIframeMessenger UPDATE_ELEMENTS schema 전환 (RED phase)", () => {
  describe("postMessage version bump", () => {
    // [RED] current: version: "legacy-1.0" 고정
    // GREEN: version: "composition-1.0" 으로 bump
    it("UPDATE_ELEMENTS message 의 version 이 'composition-1.0' 으로 bump 된다", async () => {
      const fs = await import("node:fs/promises");
      const path = await import("node:path");
      const filePath = path.resolve(__dirname, "../useIframeMessenger.ts");
      const source = await fs.readFile(filePath, "utf-8");
      // composition-1.0 등장이 확인되어야 함
      expect(source).toMatch(/version:\s*"composition-1\.0"/);
      // legacy-1.0 의 leftover 가 없어야 함 (UPDATE_ELEMENTS 메시지 한정)
      const updateElementsBlock = source.match(
        /const message = \{[\s\S]{0,300}type: "UPDATE_ELEMENTS"[\s\S]{0,300}\};/,
      );
      expect(
        updateElementsBlock,
        "UPDATE_ELEMENTS message 객체 추출 실패 — 시그니처 변경 시 regex 동기화",
      ).not.toBeNull();
      expect(updateElementsBlock![0]).not.toMatch(/version:\s*"legacy-1\.0"/);
    });
  });

  describe("pageInfo schema canonical 전환", () => {
    // [RED] current: pageInfo.layoutId 만 사용
    // GREEN: pageInfo.reusableFrameId 추가 (또는 layoutId → reusableFrameId rename)
    it("pageInfo 에 reusableFrameId 필드가 등장한다", async () => {
      const fs = await import("node:fs/promises");
      const path = await import("node:path");
      const filePath = path.resolve(__dirname, "../useIframeMessenger.ts");
      const source = await fs.readFile(filePath, "utf-8");
      // reusableFrameId 식별자 등장
      expect(source).toMatch(/reusableFrameId/);
    });

    it("UPDATE_PAGE_INFO effect 가 page/layout edit mode 전환을 dependency 로 구독한다", async () => {
      const fs = await import("node:fs/promises");
      const path = await import("node:path");
      const filePath = path.resolve(__dirname, "../useIframeMessenger.ts");
      const source = await fs.readFile(filePath, "utf-8");
      const effectBlock = source.match(
        /lastSentPageInfoRef\.current[\s\S]{0,1800}sendPageInfoToIframe\(pageId, layoutId\);[\s\S]{0,700}\]\);/,
      );
      expect(
        effectBlock,
        "UPDATE_PAGE_INFO effect block 추출 실패 — 시그니처 변경 시 regex 동기화",
      ).not.toBeNull();
      expect(effectBlock![0]).toMatch(/currentEditMode/);
      expect(effectBlock![0]).toMatch(/selectedReusableFrameId/);
    });

    it("canonical document 변경 시 UPDATE_CANONICAL_DOCUMENT 를 active sync 로 전송한다", async () => {
      const fs = await import("node:fs/promises");
      const path = await import("node:path");
      const filePath = path.resolve(__dirname, "../useIframeMessenger.ts");
      const source = await fs.readFile(filePath, "utf-8");
      const effectBlock = source.match(
        /lastSentCanonicalDocumentRef[\s\S]{0,900}sendCanonicalDocumentToIframe\(activeCanonicalDocument\);[\s\S]{0,300}\[activeCanonicalDocument, isWebGLOnly, sendCanonicalDocumentToIframe\]/,
      );
      expect(
        effectBlock,
        "canonical document active sync effect 추출 실패 — 시그니처 변경 시 regex 동기화",
      ).not.toBeNull();
      expect(source).not.toContain("canonicalDocumentToElements(canonicalDoc)");
      expect(source).not.toContain("sendElementsToIframe(elements)");
    });

    it("runtime compare mode 에서는 WebGL-only no-op 으로 빠지지 않는다", async () => {
      const fs = await import("node:fs/promises");
      const path = await import("node:path");
      const filePath = path.resolve(__dirname, "../useIframeMessenger.ts");
      const source = await fs.readFile(filePath, "utf-8");

      expect(source).toContain("useCompareModeStore");
      expect(source).toContain("runtimeCompareMode");
      expect(source).toContain(
        "isWebGLCanvas() && !isCanvasCompareMode() && !runtimeCompareMode",
      );
    });

    it("canonical document 를 Preview 에 별도 전송해 Preview 내부 projection 을 제거한다", async () => {
      const fs = await import("node:fs/promises");
      const path = await import("node:path");
      const filePath = path.resolve(__dirname, "../useIframeMessenger.ts");
      const source = await fs.readFile(filePath, "utf-8");

      expect(source).toContain("useActiveCanonicalDocument");
      expect(source).toContain("UPDATE_CANONICAL_DOCUMENT");
      expect(source).toContain("sendCanonicalDocumentToIframe(canonicalDoc)");
      expect(source).toContain(
        "sendCanonicalDocumentToIframe(activeCanonicalDocument)",
      );
    });

    it("selection echo 는 elementsMap subscription 대신 canonical document traversal 을 우선 사용한다", async () => {
      const fs = await import("node:fs/promises");
      const path = await import("node:path");
      const filePath = path.resolve(__dirname, "../useIframeMessenger.ts");
      const source = await fs.readFile(filePath, "utf-8");

      expect(source).toContain("getActiveCanonicalDocumentForPreviewRead");
      expect(source).toContain("getActiveCanonicalPreviewElements");
      expect(source).toContain("visitCanonicalDocumentElements");
      expect(source).toContain("getElementForPreviewSelection");
      expect(source).toContain("getPreviewGeneratedElementIds");
      expect(source).not.toContain("canonicalElementSnapshot");
      expect(source).not.toContain("useStore.getState().elements.find");
      expect(source).not.toContain("useStore.getState().elements.map");
      expect(source).not.toContain(
        ["const elementsMap = useStore((state) => state", "elementsMap);"].join(
          ".",
        ),
      );
      expect(source).not.toContain(
        "const { elementsMap } = useStore.getState();",
      );
    });

    it("page/frame mirror field access 는 frameMirror adapter 를 경유한다", async () => {
      const fs = await import("node:fs/promises");
      const path = await import("node:path");
      const filePath = path.resolve(__dirname, "../useIframeMessenger.ts");
      const source = await fs.readFile(filePath, "utf-8");

      expect(source).not.toContain("legacyElementFields");
      expect(source).toContain('from "../../adapters/canonical/frameMirror"');
      expect(source).toContain("getNullablePageFrameBindingId");
      expect(source).toContain("withPageFrameBinding");
    });

    it("Preview inbound UPDATE_ELEMENTS recovery 로 Builder legacy store cache 를 갱신하지 않는다", async () => {
      const fs = await import("node:fs/promises");
      const path = await import("node:path");
      const filePath = path.resolve(__dirname, "../useIframeMessenger.ts");
      const source = await fs.readFile(filePath, "utf-8");

      expect(source).not.toContain("preview-recovery");
      expect(source).not.toContain("hard-resync");
      expect(source).not.toContain('syncMode === "recovery"');
      expect(source).not.toContain(
        "recoverElementsSnapshot(event.data.elements",
      );
      expect(source).not.toContain("Ignored interactive UPDATE_ELEMENTS");
    });
  });
});
