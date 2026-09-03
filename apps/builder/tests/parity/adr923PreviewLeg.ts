/**
 * ADR-923 Phase 5 후속 — **preview DOM leg** 헬퍼: production 트리의 노드를 preview `App.tsx` 와 같은
 * 순서 (`adaptElementStyle` → `rendererMap[type]`, App.tsx:828) 로 그려 computed style 을 잰다.
 *
 * shared 컴포넌트 (`Avatar.tsx` · `StatusLight.tsx` …) 를 직접 마운트하지 않는 이유: preview 는 rendererMap 을
 * 먼저 찾고, Avatar · StatusLight · TailSwatch 는 renderer 가 자체 `<div>` 를 그린다 (LayoutRenderers
 * `renderAvatar` display flex · `renderStatusLight` display inline-flex · FormRenderers `renderTailSwatch` 래퍼
 * div). publish 는 Avatar · StatusLight 를 `createHtmlElement("div")` 로 등록한다 (ComponentRegistry.tsx:483·493 —
 * oracle 아님). 같은 production props 로 두 leg 를 재려면 DOM leg 도 rendererMap 이어야 한다.
 */
import React from "react";
import { createRoot, type Root } from "react-dom/client";
import { rendererMap } from "@composition/shared/renderers";
import { adaptElementStyle } from "@composition/shared/utils";
import type {
  ElementProps,
  PreviewElement,
  RenderContext,
} from "@composition/shared/types";
import type { Element } from "@/types/core/store.types";

export function toPreviewElement(el: Element): PreviewElement {
  return {
    id: el.id,
    customId: el.customId,
    type: el.type,
    props: (el.props ?? {}) as ElementProps,
    parent_id: el.parent_id ?? null,
    page_id: el.page_id ?? null,
  };
}

/** preview App 의 renderContext 중 rendererMap 이 읽는 필드만 — 쓰기 계열은 no-op. */
export function stubRenderContext(
  elements: PreviewElement[],
  editMode: "page" | "layout",
): RenderContext {
  const elementsById = new Map(elements.map((e) => [e.id, e] as const));
  const childrenByParent = new Map<string, PreviewElement[]>();
  for (const e of elements) {
    if (!e.parent_id) continue;
    const list = childrenByParent.get(e.parent_id) ?? [];
    list.push(e);
    childrenByParent.set(e.parent_id, list);
  }
  const ctx: RenderContext = {
    elements,
    elementsById,
    childrenByParent,
    updateElementProps: () => {},
    batchUpdateElementProps: () => {},
    setElements: () => {},
    renderElement: (el, key) => {
      const r = rendererMap[el.type];
      return r
        ? React.createElement(React.Fragment, { key: key ?? el.id }, r(el, ctx))
        : null;
    },
    editMode,
  };
  return ctx;
}

class Boundary extends React.Component<
  { children: React.ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/**
 * `host` 안에 400px block mount 를 만들고 node 를 그린 뒤 첫 자식 (renderer root) 을 돌려준다.
 * 마운트한 root 는 `roots` 에 쌓인다 — 호출측 afterAll 이 unmount 한다.
 */
export async function mountPreviewNode(
  host: HTMLElement,
  roots: Root[],
  node: React.ReactNode,
  width = 400,
): Promise<HTMLElement | null> {
  const mount = document.createElement("div");
  mount.style.cssText = `width:${width}px;`;
  host.appendChild(mount);
  const rt = createRoot(mount);
  roots.push(rt);
  await new Promise<void>((resolve) => {
    rt.render(React.createElement(Boundary, null, node));
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
  return mount.firstElementChild as HTMLElement | null;
}

/**
 * production 트리 (root + 자손) 의 root 를 preview 경로로 그린다. Slot 은 frame 편집 (`editMode:"layout"`)
 * 에서만 placeholder 상자를 만든다 — Canvas 가 그리는 Slot 상자와 같은 상태.
 */
export async function mountProductionRoot(
  host: HTMLElement,
  roots: Root[],
  elements: Element[],
  editMode: "page" | "layout" = "page",
): Promise<HTMLElement | null> {
  const previews = elements.map(toPreviewElement);
  const root = previews[0];
  const renderer = rendererMap[root.type];
  if (!renderer) throw new Error(`${root.type}: rendererMap 항목 없음`);
  const ctx = stubRenderContext(previews, editMode);
  return mountPreviewNode(host, roots, renderer(adaptElementStyle(root), ctx));
}

export function computedDisplayOf(el: HTMLElement | null): string {
  return el
    ? `${el.tagName.toLowerCase()}:${getComputedStyle(el).display}`
    : "(없음)";
}
