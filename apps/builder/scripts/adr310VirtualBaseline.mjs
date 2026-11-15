// ADR-310 G8 ⑤ 대조군 — 순수 RAC ListBox + Virtualizer (우리 렌더 경로 없음). 사용자 결정
// (2026-11-15): 가상 스크롤의 frame 은 「더 보기」 (compositor 스크롤 — main thread 일 0) 가 아니라
// **같은 문서의 순수 RAC 가상 목록** 과 비교한다. `adr310-g8-virtual-live.mjs` 가 Publish 문서에
// 붙인다 — dev 는 Vite 가 이 파일을 그대로 (`/@fs`), production 은 하니스가 Vite lib build 로 dist
// 옆에 `g8-racbase.js` 를 만든다. 우리 목록과 같은 상자: 600 × 300 · 행 32 · padding 4 · 1px 테두리.
import { createElement as h } from "react";
import { createRoot } from "react-dom/client";
import {
  ListBox,
  ListBoxItem,
  ListLayout,
  Virtualizer,
} from "react-aria-components";

export function mount(rows, estimate = false) {
  const host = document.createElement("div");
  host.style.cssText =
    "position:fixed;right:16px;top:16px;z-index:10;background:#fff";
  document.body.appendChild(host);
  const items = Array.from({ length: rows }, (_, i) => ({
    id: `p${i + 1}`,
    name: `Person${i + 1}`,
  }));
  createRoot(host).render(
    h(
      Virtualizer,
      {
        layout: ListLayout,
        // (`estimate` — 우리 목록과 같은 조건: Preview 에 배치 geometry 가 없어 행 크기를 추정 40 으로
        //  주고 RAC 가 보이는 행을 잰다.)
        layoutOptions: estimate
          ? { estimatedRowSize: 40, padding: 4 }
          : { rowSize: 32, padding: 4 },
      },
      h(
        ListBox,
        {
          "aria-label": "RAC baseline",
          id: "g8-base",
          items,
          selectionMode: "single",
          style: {
            display: "block",
            width: 600,
            height: 300,
            overflow: "auto",
            border: "1px solid #ccc",
            boxSizing: "border-box",
          },
        },
        (item) =>
          h(
            ListBoxItem,
            {
              id: item.id,
              textValue: item.name,
              style: {
                display: "flex",
                alignItems: "center",
                height: "100%",
                padding: "0 12px",
                boxSizing: "border-box",
                font: "500 14px Pretendard, sans-serif",
              },
            },
            h("span", null, item.name),
          ),
      ),
    ),
  );
}
