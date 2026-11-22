/**
 * S2 체크리스트 부록 C.1 (2026-11-22) — 선언된 enum 의 빠진 값 둘.
 *
 * ColorArea `xChannel` · `yChannel` 의 `alpha` 는 채택하지 않는다: 설치 타입 (`ColorChannel`) 은 받지만 RAC 의
 * 면 그라데이션 (`useColorAreaGradient`) 이 alpha 축을 그리지 못하고 (rgb 는 alpha 를 0 · 255 로 놓아 같은 색,
 * hsl · hsb 는 축 표에 alpha 가 없다) S2 ColorArea 도 alpha 를 다루지 않는다 — RAC 로 구현할 수 없는 값.
 * 아래 oracle 은 설치본이 alpha 를 그리게 되면 실패해 다시 판정하게 한다.
 *
 * MenuTrigger `trigger` 의 `contextMenu` (S2 · RAC 설치 타입):
 *   - 우클릭 · 터치 길게 누르기 · OS 키로 열리고 메뉴는 누른 자리에 선다 (RAC `useMenuTrigger` 의
 *     `useContextMenu` — `state.setPoint`);
 *   - 그 메뉴의 Popover 는 offset 0 (S2 `Menu.tsx` · RAC `MenuTrigger` 의 `PopoverContext` — `trigger ===
 *     'contextMenu' ? 0 : 8`). Popover 노드가 기본값 8 을 늘 들고 있어 그대로 넘기면 context 의 0 을 덮으므로,
 *     작성하지 않은 기본 offset 은 owner 의 trigger 가 정한다 — DOM · Canvas 가 같은 판정 하나를 읽는다.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { colorAreaBinding } from "../../../../../../packages/shared/src/catalog/bindings/ColorArea.binding";
import { menuTriggerBinding } from "../../../../../../packages/shared/src/catalog/bindings/MenuTrigger.binding";
import {
  catalogOverlayPlacement,
  catalogOverlayPopoverOffset,
} from "../../../../../../packages/shared/src/catalog/runtime/overlayLayout";
import type { CatalogConsumerNode } from "../../../../../../packages/shared/src/catalog/runtime/compositionRoot";

const REPO = resolve(__dirname, "../../../../../..");
const read = (path: string) => readFileSync(resolve(REPO, path), "utf8");

describe("S2 C.1 — MenuTrigger trigger contextMenu", () => {
  it("S2 · RAC 가 contextMenu 를 받고 그 메뉴의 Popover offset 을 0 으로 둔다 (설치본)", () => {
    expect(
      read("apps/builder/node_modules/@react-spectrum/s2/src/Menu.tsx"),
    ).toMatch(/offset: props\.trigger === 'contextMenu' \? 0 : 8/);
  });

  it("binding 의 trigger 선택지에 contextMenu 가 있다", () => {
    const options = (
      menuTriggerBinding.props.accepts.trigger as {
        options: { value: string }[];
      }
    ).options.map((o) => o.value);
    expect(options).toEqual(["press", "longPress", "contextMenu"]);
  });

  it("contextMenu 메뉴의 Popover 는 작성하지 않은 offset 이면 0, 작성값은 그대로", () => {
    const menu = (trigger: string) => ({ trigger });
    expect(
      catalogOverlayPopoverOffset("MenuTrigger", menu("contextMenu"), 8),
    ).toBe(0);
    expect(
      catalogOverlayPopoverOffset(
        "MenuTrigger",
        menu("contextMenu"),
        undefined,
      ),
    ).toBe(0);
    expect(
      catalogOverlayPopoverOffset("MenuTrigger", menu("contextMenu"), 4),
    ).toBe(4);
    expect(catalogOverlayPopoverOffset("MenuTrigger", menu("press"), 8)).toBe(
      8,
    );
    expect(catalogOverlayPopoverOffset("Select", {}, 8)).toBe(8);
  });

  it("Canvas 의 열린 context 메뉴는 trigger 바로 아래 (DOM 과 같은 offset 0), press 메뉴는 8 아래", () => {
    const place = (trigger: string, offset = 8) =>
      catalogOverlayPlacement(
        { props: { offset } } as unknown as CatalogConsumerNode,
        {
          modal: false,
          owner: {
            ruleId: "MenuTrigger",
            props: { trigger },
          } as unknown as CatalogConsumerNode,
        },
        { x: 100, y: 100, width: 60, height: 32 },
        { x: 0, y: 0, width: 120, height: 112 },
        { width: 1200, height: 900 },
        "en-US",
      ).y;
    expect(place("contextMenu")).toBe(132);
    expect(place("press")).toBe(140);
    expect(place("contextMenu", 20)).toBe(152);
  });
});

describe("S2 C.1 — ColorArea alpha 축은 채택하지 않는다", () => {
  it("설치 RAC 의 면 그라데이션 · S2 ColorArea 가 alpha 를 다루지 않는다 (oracle)", () => {
    const gradient = read(
      "node_modules/.pnpm/react-aria@3.53.1_patch_hash=8fdbff66a8ab37501bc381dc7d4d3da46968bd1c26b7f9479ec650bbda_9c18f3d0d8136f82624f454f7dcaf58d/node_modules/react-aria/dist/private/color/useColorAreaGradient.mjs",
    );
    expect(gradient).not.toMatch(/alpha/);
    expect(
      read("apps/builder/node_modules/@react-spectrum/s2/src/ColorArea.tsx"),
    ).not.toMatch(/alpha/);
  });

  it("binding 의 축 선택지에 alpha 가 없다", () => {
    for (const key of ["xChannel", "yChannel"] as const) {
      const options = (
        colorAreaBinding.props.accepts[key] as { options: { value: string }[] }
      ).options.map((o) => o.value);
      expect(options, key).not.toContain("alpha");
    }
  });
});
