/**
 * Builder → Preview canonical 단일 채널 계약 검증.
 *
 * ADR-125 이후 bulk node sync는 UPDATE_CANONICAL_DOCUMENT만 사용한다.
 * 제거된 UPDATE_ELEMENTS/ACK 기반 자동 선택 protocol이 다시 추가되지 않도록
 * 송신 hook과 기존 호출자를 함께 고정한다.
 */

import { describe, it, expect } from "vitest";

describe("Builder → Preview canonical 단일 채널", () => {
  describe("legacy bulk sync 제거", () => {
    it("UPDATE_ELEMENTS 송신·queue·ACK 상태를 보유하지 않는다", async () => {
      const fs = await import("node:fs/promises");
      const path = await import("node:path");
      const filePath = path.resolve(__dirname, "../useIframeMessenger.ts");
      const source = await fs.readFile(filePath, "utf-8");
      const previewHandlerSource = await fs.readFile(
        path.resolve(__dirname, "../../../preview/messaging/messageHandler.ts"),
        "utf-8",
      );

      expect(source).not.toContain("sendElementsToIframe");
      expect(source).not.toContain("UPDATE_ELEMENTS");
      expect(source).not.toContain("ELEMENTS_UPDATED_ACK");
      expect(source).not.toContain("lastAckTimestampRef");
      expect(source).not.toContain("isSendingRef");
      expect(source).not.toContain("pendingAutoSelectElementId");
      expect(source).not.toContain("requestElementSelection");
      expect(source).not.toContain("REQUEST_ELEMENT_SELECTION");
      expect(previewHandlerSource).not.toContain("REQUEST_ELEMENT_SELECTION");
    });

    it("호출자가 제거된 ACK 기반 자동 선택 API를 사용하지 않는다", async () => {
      const fs = await import("node:fs/promises");
      const path = await import("node:path");
      const relativePaths = [
        "../../main/BuilderCore.tsx",
        "../usePageManager.ts",
        "../../panels/navigator/NavigatorPanel.tsx",
        "../../panels/navigator/PagesSection.tsx",
        "../../panels/navigator/FramesTab/FramesTab.tsx",
      ];
      const sources = await Promise.all(
        relativePaths.map((relativePath) =>
          fs.readFile(path.resolve(__dirname, relativePath), "utf-8"),
        ),
      );

      for (const source of sources) {
        expect(source).not.toContain("requestAutoSelectAfterUpdate");
      }
    });
  });

  describe("pageInfo와 canonical document 동기화", () => {
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
        /ownsIframeTransportRef\.current[\s\S]{0,1200}sendCanonicalDocumentToIframe\(activeCanonicalDocument\);[\s\S]{0,300}\[[\s\S]{0,180}activeCanonicalDocument,[\s\S]{0,180}iframeReadyState,[\s\S]{0,180}isWebGLOnly,[\s\S]{0,180}sendCanonicalDocumentToIframe,[\s\S]{0,180}\]/,
      );
      expect(
        effectBlock,
        "canonical document active sync effect 추출 실패 — 시그니처 변경 시 regex 동기화",
      ).not.toBeNull();
      expect(source).not.toContain("canonicalDocumentToElements(canonicalDoc)");
      expect(source).not.toContain("sendElementsToIframe(elements)");
    });

    // ADR-151 잔여 ② — hidden 탭 preview 정체 회귀 가드.
    // canonical 재송신은 hidden 탭에서 동작하지 않는 requestAnimationFrame(scheduleNextFrame)
    // 이 아니라 scheduleFrameOrTimeout 로 예약해야 한다 (background 탭 parity 자동화가
    // reload 없이 preview 를 읽을 수 있도록).
    it("canonical 재송신은 hidden 탭에서도 동작하는 scheduleFrameOrTimeout 로 예약한다", async () => {
      const fs = await import("node:fs/promises");
      const path = await import("node:path");
      const filePath = path.resolve(__dirname, "../useIframeMessenger.ts");
      const source = await fs.readFile(filePath, "utf-8");
      const effectBlock = source.match(
        /pendingCanonicalDocumentCancelRef\.current = (\w+)\(\(\) => \{[\s\S]{0,300}sendCanonicalDocumentToIframe\(activeCanonicalDocument\);/,
      );
      expect(
        effectBlock,
        "canonical 재송신 스케줄 블록 추출 실패 — 시그니처 변경 시 regex 동기화",
      ).not.toBeNull();
      expect(effectBlock![1]).toBe("scheduleFrameOrTimeout");
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
      expect(source).toContain("readCurrentCanonicalDocumentSnapshot");
      expect(source).toContain(
        "sendCanonicalDocumentToIframe(activeCanonicalDocument)",
      );
    });

    it("iframe load가 PREVIEW_READY를 먼저 받은 세대의 ready 상태를 되돌리지 않는다", async () => {
      const fs = await import("node:fs/promises");
      const path = await import("node:path");
      const filePath = path.resolve(__dirname, "../useIframeMessenger.ts");
      const source = await fs.readFile(filePath, "utf-8");

      expect(source).toContain(
        'const hadPreviewReady = iframeReadyStateRef.current === "ready"',
      );
      expect(source).toContain(
        'iframeReadyStateRef.current = hadPreviewReady ? "ready" : "loading"',
      );
    });

    it("selection echo와 generated ID 필터는 canonical indexed read를 우선 사용한다", async () => {
      const fs = await import("node:fs/promises");
      const path = await import("node:path");
      const filePath = path.resolve(__dirname, "../useIframeMessenger.ts");
      const source = await fs.readFile(filePath, "utf-8");

      expect(source).toContain("getActiveCanonicalDocumentForPreviewRead");
      expect(source).toContain("getActiveCanonicalElementById");
      expect(source).toContain("getCanonicalDocumentProjectableNodeIds");
      expect(source).toContain("getElementForPreviewSelection");
      expect(source).toContain("filterNewPreviewGeneratedElements");
      expect(source).not.toContain("visitCanonicalDocumentElements");
      expect(source).not.toContain("getActiveCanonicalPreviewElements");
      expect(source).not.toContain("getPreviewGeneratedElementIds");
      expect(source).not.toContain("canonicalElementSnapshot");
      expect(source).not.toContain("useStore.getState().elements.find");
      expect(source).not.toContain("useStore.getState().elements.map");
      expect(source).toContain(
        "useStore.getState().elementsMap.get(elementId)",
      );
      expect(source).toContain("!elementsMap.has(element.id)");
      expect(source).not.toContain("legacyElements");
      expect(source).not.toContain(
        ["const elementsMap = useStore((state) => state", "elementsMap);"].join(
          ".",
        ),
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
