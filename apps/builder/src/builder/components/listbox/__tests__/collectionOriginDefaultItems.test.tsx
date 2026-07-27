import { render, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  detectListBoxAuthoringMode,
  ensureListBoxTemplateOrigins,
  LISTBOX_ORIGIN_ID,
} from "../listBoxTemplateOrigins";
import {
  ensureGridListTemplateOrigins,
  GRIDLIST_ORIGIN_ID,
} from "../../gridlist/gridListTemplateOrigins";
import { ListBox } from "@composition/shared/components/ListBox";
import type { CanonicalNode, CompositionDocument } from "@composition/shared";

/**
 * collection origin 의 **기본 items** 회귀 가드 (2026-07-27).
 *
 * 행 템플릿(`component-listbox-item-*` / `component-gridlist-item-default`)은
 * `{icon}`/`{label}`/`{description}` 을 보간한다. 그래서 origin 의 `props.items` 가 비면
 * 보간할 대상이 없어 **컬렉션이 통째로 빈 채로 남고**, 컴포넌트 라이브러리 마스터가 자기
 * 모습을 못 보여준다 (실측: preview 에서 `role="listbox"` 의 자식 0개).
 *
 * 되돌아가기 쉬운 지점이라 두 축을 같이 고정한다 — ① 기본 items 가 실려 있는가,
 * ② 그 결과 authoring mode 가 **data-bound** 로 판정되는가 (빈 items 는 static 으로 떨어져
 * 정적 자식도 없는 빈 상태가 된다). ①만 보면 판정식이 바뀌어도 안 잡힌다.
 */

function emptyDoc(): CompositionDocument {
  return { version: "composition-1.0", children: [] } as CompositionDocument;
}

function findOrigin(
  doc: CompositionDocument,
  id: string,
): CanonicalNode | undefined {
  let hit: CanonicalNode | undefined;
  const walk = (nodes: readonly CanonicalNode[]): void => {
    for (const n of nodes) {
      if (n.id === id) hit = n;
      walk(n.children ?? []);
    }
  };
  walk(doc.children ?? []);
  return hit;
}

describe("collection origin 기본 items — 빈 컬렉션 재발 차단", () => {
  it("ListBox origin 이 label/description/icon 3필드를 갖춘 행을 싣는다", () => {
    const doc = ensureListBoxTemplateOrigins(emptyDoc());
    const origin = findOrigin(doc, LISTBOX_ORIGIN_ID);
    const items = origin?.props?.items as
      | Array<Record<string, unknown>>
      | undefined;

    expect(items?.length ?? 0).toBeGreaterThan(0);
    // 템플릿이 보간하는 키가 실제로 있어야 한다 — 하나라도 빠지면 그 slot 이 빈칸이 된다.
    for (const item of items ?? []) {
      expect(Object.keys(item)).toEqual(
        expect.arrayContaining(["id", "icon", "label", "description"]),
      );
    }
  });

  it("GridList origin 이 label/description 행을 싣는다 (icon slot 없음)", () => {
    const doc = ensureGridListTemplateOrigins(emptyDoc());
    const origin = findOrigin(doc, GRIDLIST_ORIGIN_ID);
    const items = origin?.props?.items as
      | Array<Record<string, unknown>>
      | undefined;

    expect(items?.length ?? 0).toBeGreaterThan(0);
    for (const item of items ?? []) {
      expect(Object.keys(item)).toEqual(
        expect.arrayContaining(["id", "label", "description"]),
      );
    }
  });

  it("기본 items 덕분에 ListBox origin 이 data-bound 로 판정된다", () => {
    // 빈 items 면 static + 정적 자식 0개 = 아무것도 안 그려지는 상태로 되돌아간다.
    const doc = ensureListBoxTemplateOrigins(emptyDoc());
    const origin = findOrigin(doc, LISTBOX_ORIGIN_ID);

    expect(
      detectListBoxAuthoringMode({
        props: origin?.props as Record<string, unknown>,
        children: origin?.children as never,
      }),
    ).toEqual({ mode: "data-bound", rowDataSource: "items" });
  });

  it("사용자가 비운 items 는 시드가 되살리지 않는다 (기존 문서 보존)", () => {
    // repairOrigin 은 기존 props 를 보존한다 — 재시드가 사용자 편집을 덮으면 안 된다.
    const seeded = ensureListBoxTemplateOrigins(emptyDoc());
    const origin = findOrigin(seeded, LISTBOX_ORIGIN_ID);
    if (origin) {
      (origin.props as Record<string, unknown>).items = [];
    }

    const reseeded = ensureListBoxTemplateOrigins(seeded);
    const after = findOrigin(reseeded, LISTBOX_ORIGIN_ID);
    expect((after?.props?.items as unknown[])?.length ?? -1).toBe(0);
  });
  it("시드 items 가 실제로 행으로 렌더된다 (값만 있고 안 보이는 상태 차단)", async () => {
    // items 를 들고만 있고 렌더 경로가 끊기면 여전히 빈 컬렉션이다 — 여기서 같이 잡는다.
    const doc = ensureListBoxTemplateOrigins(emptyDoc());
    const items = findOrigin(doc, LISTBOX_ORIGIN_ID)?.props?.items as Array<
      Record<string, string>
    >;

    const { container } = render(
      <ListBox items={items} aria-label="seed default items" />,
    );
    // 정적 items 도 collection source 해소가 한 tick 걸린다 (로딩 플레이스홀더 → 행).
    await waitFor(() => {
      expect(container.querySelectorAll('[role="option"]').length).toBe(
        items.length,
      );
    });
    // label 만 확인한다 — icon/description slot 은 ref-composite(행 템플릿) 경로 소관이고,
    // 여기서 쓰는 shared ListBox 의 일반 items 경로는 라벨만 렌더한다. 이 테스트의 관심사는
    // "시드 items 가 행으로 보이는가" 이지 템플릿 조합이 아니다.
    expect(container.textContent).toContain("Inbox");
    expect(container.textContent).toContain("Archive");
  });
});
