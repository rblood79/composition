/**
 * ADR-013 HC5 / 검증 시나리오 3 — **연결된 0건 ≠ 미연결**. collection 에 바인딩된 컴포넌트는
 * 행이 0 이어도 정적 children (factory `props.items` 로 만든 JSX) 으로 되돌아가면 안 된다.
 * Skia projection (`resolveCollectionItems`) 은 dataBinding 이 있으면 `[]` 를 내므로, DOM 이
 * 정적 items 를 그리면 두 leg 가 갈린다 (D3 대칭 위반) 이고 사용자는 "연결됐는데 샘플이 그대로"
 * 를 본다 (ADR-013 live 실측 2026-09-17 — ref ListBox 를 빈 테이블에 연결했더니 origin 의
 * Aardvark/Cat/Kangaroo 3행이 그대로 남았다).
 *
 * SSR 정적 출력으로 본다 (packages/shared 는 @testing-library 미보유). dataTable 바인딩은
 * useCollectionData 의 sync memo 라 effect 없이 해소된다.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { CollectionDataProvider } from "../../hooks/CollectionDataProvider";
import { ListBox, ListBoxItem } from "../ListBox";
import { GridList, GridListItem } from "../GridList";
import type { DataBinding } from "../../types";

const services = {
  dataTableService: {
    getDataTables: () => [
      {
        id: "c-empty",
        name: "Empty rows",
        schema: [{ id: "f1", key: "name", type: "string" as const }],
        mockData: [],
        useMockData: true,
      },
      {
        id: "c-two",
        name: "Two rows",
        schema: [{ id: "f1", key: "name", type: "string" as const }],
        mockData: [
          { id: 1, name: "Ana" },
          { id: 2, name: "Bo" },
        ],
        useMockData: true,
      },
    ],
  },
} as never;

const binding = (collectionId: string): DataBinding =>
  ({ source: "dataTable", collectionId, name: "x" }) as unknown as DataBinding;

const staticItems = [
  { id: "a", label: "Aardvark" },
  { id: "b", label: "Cat" },
];

const optionCount = (html: string) => html.split('role="option"').length - 1;
const rowCount = (html: string) => html.split('role="row"').length - 1;

describe("연결된 0건 ≠ 미연결 (ADR-013 HC5)", () => {
  it("ListBox: 빈 collection 에 바인딩 → option 0 · 정적 children 미렌더 (2행 collection 은 2행)", () => {
    const render = (collectionId: string) =>
      renderToStaticMarkup(
        <CollectionDataProvider services={services}>
          <ListBox dataBinding={binding(collectionId)} items={staticItems}>
            {staticItems.map((it) => (
              <ListBoxItem key={it.id} id={it.id} textValue={it.label}>
                {it.label}
              </ListBoxItem>
            ))}
          </ListBox>
        </CollectionDataProvider>,
      );
    const empty = render("c-empty");
    expect(optionCount(empty)).toBe(0);
    expect(empty).not.toContain("Aardvark");
    expect(empty).toContain('role="listbox"');
    expect(optionCount(render("c-two"))).toBe(2);
  });

  it("GridList: 빈 collection 에 바인딩 → row 0 · 정적 children 미렌더", () => {
    const html = renderToStaticMarkup(
      <CollectionDataProvider services={services}>
        <GridList dataBinding={binding("c-empty")} items={staticItems}>
          {staticItems.map((it) => (
            <GridListItem key={it.id} id={it.id} textValue={it.label}>
              {it.label}
            </GridListItem>
          ))}
        </GridList>
      </CollectionDataProvider>,
    );
    expect(rowCount(html)).toBe(0);
    expect(html).not.toContain("Aardvark");
  });
});
