import { getActiveCanonicalDocument } from "../../stores/canonical/canonicalElementsBridge";
import { visitCanonicalDocumentElements } from "../../stores/canonical/canonicalElementsView";
import { generateCustomId } from "../../utils/idGeneration";
import { withFrameElementMirrorId } from "../../../adapters/canonical/frameMirror";
import type { Element } from "../../../types/builder/unified.types";

export type ListBoxItemSlotRole = "icon" | "label" | "description";

/**
 * ADR-148 Phase 0 — ListBoxItem slot 자식 재생성 payload.
 *
 * ListBoxItemEditor 의 양방향 동기(내용 설정 시 제거된 slot 자식 재생성)가 사용한다.
 * store Element payload 구성은 편집기 밖(본 액션 모듈)에 둔다 — 편집기 canonical-first
 * 정적 가드(canonicalPropertyEditors.static.test.ts)와 정합, ButtonChildSection
 * `buildButtonChild` 선례 동형.
 *
 * origin seed(listBoxTemplateOrigins.listBoxItemSlotChildren)와 동일 규약 —
 * `props.slot`(shared getSlotRole 의 fallback 판독 축) + 템플릿 바인딩 `{키}` 만 넣고
 * 기본 props 를 주입하지 않는다(slot 자식 style 은 구성 overlay 로 소비되므로 노이즈 금지).
 */
export function createListBoxItemSlotChildElement(opts: {
  role: ListBoxItemSlotRole;
  parentId: string;
  pageId: string;
}): Element {
  const { role, parentId, pageId } = opts;

  const doc = getActiveCanonicalDocument();
  const pageElements: Element[] = [];
  if (doc) {
    visitCanonicalDocumentElements(doc, (el) => {
      pageElements.push(el);
    });
  }

  const type = role === "icon" ? "Icon" : "Text";
  return withFrameElementMirrorId(
    {
      id: crypto.randomUUID(),
      type,
      customId: generateCustomId(type, pageElements),
      props:
        role === "icon"
          ? { slot: "icon", iconName: "{icon}" }
          : { slot: role, children: `{${role}}` },
      page_id: pageId,
      parent_id: parentId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as Element,
    null,
  );
}
