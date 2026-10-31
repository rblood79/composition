import { expect, it } from "vitest";
import type { EntryId } from "../../../../../../../packages/shared/src/catalog/document/types";
import type { CatalogSessionState } from "../../../catalogRuntime/session";
import { catalogRulerOrigin } from "./catalogRulerOrigin";

const pageId = "page:first" as NonNullable<CatalogSessionState["pageId"]>;
const frames = new Map([[pageId, { x: 470, y: 300 }]]);

it("첫 페이지를 자동 활성화해도 선택이 없으면 중앙 원점을 사용한다", () => {
  expect(catalogRulerOrigin({ pageId, selection: [] }, frames)).toBeNull();
  expect(
    catalogRulerOrigin({ pageId: undefined, selection: [] }, frames),
  ).toBeNull();
});

it("페이지·내부 요소 선택 중에는 해당 page 원점, 선택 해제 후에는 중앙을 사용한다", () => {
  const selection: CatalogSessionState["selection"] = [
    {
      identity: "body",
      target: { kind: "node", id: "body" as EntryId<"node"> },
    },
  ];
  expect(catalogRulerOrigin({ pageId, selection }, frames)).toEqual({
    x: 470,
    y: 300,
  });
  expect(catalogRulerOrigin({ pageId, selection: [] }, frames)).toBeNull();
  expect(catalogRulerOrigin({ pageId, selection }, new Map())).toBeNull();
});
