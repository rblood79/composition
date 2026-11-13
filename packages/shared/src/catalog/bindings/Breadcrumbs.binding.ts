/**
 * ADR-142 family ④(collections) — Breadcrumbs primitive 의 `PrimitiveBinding`.
 *
 * DOM = `CATALOG_DELEGATED_DOM.breadcrumbs` (delegatedDom.tsx): composition `Breadcrumbs` 안에 Breadcrumb
 * 자식 노드만 그린다 (각 조각은 `breadcrumb` 항목 — RAC `Breadcrumb`). 항목은 origin template 의 Breadcrumb
 * 자식 노드다 (reusableOriginLibrary.ts).
 *
 * **Tag/Tab 과 차이**: 중간 컨테이너 없음(Breadcrumbs→Breadcrumb 1단 직접) → propagation 불요.
 */

import type { PrimitiveBinding } from "../types";

export const breadcrumbsBinding: PrimitiveBinding = {
  source: {
    kind: "internal",
    renderer: "breadcrumbs",
  },
  props: {
    accepts: {
      dataBinding: {
        kind: "binding",
        label: "Data source",
        section: "collection",
      },
      size: {
        kind: "size",
        label: "Size",
        section: "appearance",
        default: "M",
      },
      // separator (문자) 는 2026-09-29 제거 — 구분자는 조각의 편집 가능한 Icon 자식 (사용자 결정).
      // separatorIcon (2026-11-13 사용자 결정): 목록의 구분자 아이콘 — 모든 조각의 구분자 Icon 이 따르고,
      //   조각에서 직접 바꾼 구분자는 그 조각만 이긴다 (`presence.ts` `_ownerIconName`). S2 · v3 에 없는
      //   composition 확장 (`d2Provenance.ts`).
      separatorIcon: {
        kind: "icon",
        label: "Separator Icon",
        section: "content",
        default: "s2-chevron",
      },
      // menuIcon (2026-11-13 사용자 결정): 넘침 접기의 폴더 메뉴 버튼 아이콘 (S2 `BreadcrumbMenu` 의
      //   FolderBreadcrumb) — Canvas `settleBreadcrumbs` · DOM `BreadcrumbsRun` 이 같이 읽는다.
      menuIcon: {
        kind: "icon",
        label: "Menu Icon",
        section: "content",
        default: "s2-folder-breadcrumb",
      },
      // showRoot/isMultiline 은 2026-09-10 제거 — RSP v3 개념이나 DOM·Skia 어느 쪽도 읽지 않는
      //   미구현 surface 였다. 채택하려면 collapse/multiline 렌더를 두 leg 에 같이 구현한 뒤 되살린다.
      isDisabled: { kind: "boolean", label: "Disabled", section: "state" },
    },
    toRacProps: "default",
  },
};
