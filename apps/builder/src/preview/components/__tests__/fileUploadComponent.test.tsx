/**
 * ADR-201 Phase 3 — shared `FileUpload` DOM consumer 단위 (jsdom).
 *
 * 엔진은 fake 모듈 (dryRun 진행률 시뮬레이션) 을 `loadEngine` 으로 주입한다 — 실제
 * `@composition/upload` 는 이 worktree 에 없다 (통합 후 실배선 live 가 대신 확인).
 * 확인하는 것:
 *   1) idle: host 가 넘긴 canonical 자식 (입력 표면 + 샘플 행) 을 그대로 그린다
 *   2) 파일 유입 → 엔진 lazy 로드 → 샘플 행이 런타임 행 (GridList + ProgressBar) 으로 바뀐다
 *      · 파일명은 텍스트 노드 (React escape) · 오류 코드는 `data-code`
 *   3) 엔진 로드 실패 → `E_ENGINE_UNAVAILABLE` + 정적 UI 유지 (console error 0)
 *   4) dryRun=false + vault placeholder 헤더 → `E_UNAUTHORIZED`, 엔진을 부르지 않는다 (m4)
 *   5) 문서 write 0 — 컴포넌트는 updateElementProps 같은 문서 채널을 받지도 않는다
 */
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { useEffect, useMemo, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  CollectionDataContext,
  type CollectionDataServices,
} from "@composition/shared";
import { FileUpload } from "@composition/shared/components/FileUpload";
import type { UploadReactModule } from "@composition/shared";
import { useFileUploadIntake } from "@composition/shared";

afterEach(cleanup);

type Item = ReturnType<UploadReactModule["useUploadQueue"]>["items"][number];

/** dryRun 시뮬레이션 — add 즉시 queued, 옵션에 따라 첫 항목은 절반 진행 · 두 번째는 오류. */
function makeFakeEngine(): UploadReactModule {
  const useUploadQueue: UploadReactModule["useUploadQueue"] = (options) => {
    const [items, setItems] = useState<Item[]>([]);
    const api = useMemo(() => {
      const add = (files: File[]) => {
        const created: Item[] = files.map((file, index) => ({
          id: `item-${index}-${file.name}`,
          fingerprint: `${file.name}-${file.size}`,
          name: file.name,
          size: file.size,
          type: file.type,
          offset: index === 0 ? Math.floor(file.size / 2) : 0,
          status: index === 1 ? "error" : "uploading",
          attempt: 1,
          lastError:
            index === 1
              ? {
                  code: "E_PATCH_BLOCKED",
                  status: 405,
                  message: "blocked",
                  retryable: false,
                }
              : undefined,
        }));
        setItems((prev) => [...prev, ...created]);
        return created;
      };
      const noop = () => {};
      return {
        add,
        start: noop,
        pause: noop,
        resume: noop,
        cancel: noop,
        remove: noop,
        queue: {
          add,
          start: noop,
          pause: noop,
          resume: noop,
          cancel: noop,
          remove: noop,
          getItems: () => [],
          subscribe: () => noop,
          destroy: noop,
        },
      };
    }, []);
    useEffect(() => {
      // 옵션이 dryRun 으로 왔는지 기록 (preview 안전 계약)
      (globalThis as { __lastUploadOptions?: unknown }).__lastUploadOptions =
        options;
    }, [options]);
    return { items, ...api };
  };
  return {
    useUploadQueue,
    useUploadItem: () => undefined,
  };
}

/** canonical 자식 대역 — FileTrigger 자리에서 컨텍스트로 파일을 밀어 넣는다. */
function FakeTrigger({ files }: { files: File[] }) {
  const intake = useFileUploadIntake();
  return (
    <button
      type="button"
      className="react-aria-FileTrigger"
      onClick={() => intake?.addFiles(files)}
    >
      Select files
    </button>
  );
}

const services: CollectionDataServices = {
  apiEndpointService: {
    getApiEndpoints: () => [
      {
        id: "ep-vault",
        name: "Vault",
        baseUrl: "https://files.example.com",
        path: "/tus",
        headers: { Authorization: "{{secret.UPLOAD_TOKEN}}" },
      },
      {
        id: "ep-plain",
        name: "Plain",
        baseUrl: "https://files.example.com",
        path: "/tus",
      },
    ],
  },
};

const files = [
  new File([new Uint8Array(1024)], "hello.txt", { type: "text/plain" }),
  new File([new Uint8Array(2048)], "<img onerror=x>.png", {
    type: "image/png",
  }),
];

function renderFileUpload(
  props: Partial<React.ComponentProps<typeof FileUpload>> = {},
) {
  return render(
    <CollectionDataContext.Provider value={services}>
      <FileUpload
        endpoint="ep-plain"
        loadEngine={async () => makeFakeEngine()}
        inputSurface={<FakeTrigger files={files} />}
        sampleRows={
          <>
            <div className="sample-row">report.pdf</div>
            <div className="sample-row">photo.jpg</div>
          </>
        }
        {...props}
      />
    </CollectionDataContext.Provider>,
  );
}

describe("FileUpload — DOM consumer", () => {
  it("idle 상태는 입력 표면 + 샘플 행을 그대로 그린다 (Skia 와 같은 트리)", () => {
    const { container } = renderFileUpload();
    const root = container.querySelector(".react-aria-FileUpload");
    expect(root).not.toBeNull();
    expect(root?.getAttribute("data-upload-state")).toBe("idle");
    expect(container.querySelectorAll(".sample-row")).toHaveLength(2);
    expect(screen.getByText("Select files")).toBeTruthy();
    expect(container.querySelector(".react-aria-FileUpload-status")).toBeNull();
  });

  it("파일 유입 → 엔진 lazy 로드 → 런타임 행 (파일명 텍스트 · 진행률 · 오류 코드)", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const { container } = renderFileUpload();
    await act(async () => {
      screen.getByText("Select files").click();
    });
    await waitFor(() =>
      expect(
        container
          .querySelector(".react-aria-FileUpload")
          ?.getAttribute("data-upload-state"),
      ).toBe("active"),
    );
    // 샘플 행은 사라지고 런타임 행 2
    expect(container.querySelectorAll(".sample-row")).toHaveLength(0);
    await waitFor(() =>
      expect(
        container.querySelectorAll(".react-aria-FileUpload-item"),
      ).toHaveLength(2),
    );
    // 입력 표면은 유지
    expect(screen.getByText("Select files")).toBeTruthy();
    // 파일명은 텍스트 노드 — 태그로 해석되지 않는다 (React escape)
    expect(container.querySelector("img")).toBeNull();
    expect(container.textContent).toContain("<img onerror=x>.png");
    // 진행률 50% 라벨 · 오류 코드
    expect(container.textContent).toContain("50%");
    const error = container.querySelector(".react-aria-FileUpload-error");
    expect(error?.getAttribute("data-code")).toBe("E_PATCH_BLOCKED");
    // preview 안전 — 옵션이 dryRun 으로 갔다
    expect(
      (globalThis as { __lastUploadOptions?: { dryRun?: boolean } })
        .__lastUploadOptions?.dryRun,
    ).toBe(true);
    expect(errors).not.toHaveBeenCalled();
    errors.mockRestore();
  });

  it("엔진 로드 실패 → E_ENGINE_UNAVAILABLE + 정적 UI 유지, console error 0", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const { container } = renderFileUpload({ loadEngine: async () => null });
    await act(async () => {
      screen.getByText("Select files").click();
    });
    await waitFor(() =>
      expect(
        container
          .querySelector(".react-aria-FileUpload-status")
          ?.getAttribute("data-code"),
      ).toBe("E_ENGINE_UNAVAILABLE"),
    );
    expect(container.querySelectorAll(".sample-row")).toHaveLength(2);
    expect(
      container
        .querySelector(".react-aria-FileUpload")
        ?.getAttribute("data-upload-state"),
    ).toBe("idle");
    expect(errors).not.toHaveBeenCalled();
    errors.mockRestore();
  });

  it("dryRun=false + vault placeholder 헤더 → E_UNAUTHORIZED, 엔진을 부르지 않는다 (m4)", async () => {
    const loadEngine = vi.fn(async () => makeFakeEngine());
    const { container } = renderFileUpload({
      endpoint: "ep-vault",
      dryRun: false,
      loadEngine,
    });
    await act(async () => {
      screen.getByText("Select files").click();
    });
    await waitFor(() =>
      expect(
        container
          .querySelector(".react-aria-FileUpload-status")
          ?.getAttribute("data-code"),
      ).toBe("E_UNAUTHORIZED"),
    );
    expect(loadEngine).not.toHaveBeenCalled();
    expect(container.querySelectorAll(".sample-row")).toHaveLength(2);
  });

  it("dryRun=false + endpoint 미지정 → E_NO_ENDPOINT", async () => {
    const { container } = renderFileUpload({
      endpoint: undefined,
      dryRun: false,
    });
    await act(async () => {
      screen.getByText("Select files").click();
    });
    await waitFor(() =>
      expect(
        container
          .querySelector(".react-aria-FileUpload-status")
          ?.getAttribute("data-code"),
      ).toBe("E_NO_ENDPOINT"),
    );
  });

  it("isDisabled 면 유입을 받지 않는다", async () => {
    const loadEngine = vi.fn(async () => makeFakeEngine());
    const { container } = renderFileUpload({ isDisabled: true, loadEngine });
    await act(async () => {
      screen.getByText("Select files").click();
    });
    expect(loadEngine).not.toHaveBeenCalled();
    expect(
      container
        .querySelector(".react-aria-FileUpload")
        ?.getAttribute("data-disabled"),
    ).toBe("true");
  });
});
