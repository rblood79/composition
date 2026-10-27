// @vitest-environment node
/**
 * ADR-158 · ADR-280 G2 — 등재 capability 의 prop 이 **실제로 컴포넌트에 닿는가**.
 *
 * **Why (2026-08-16 라이브 실측)**: `CAPABILITY_REGISTRY.Modal.open` 은 등재돼 있었지만
 * `Modal.binding.accepts` 에 `isOpen` 이 없어 RAC 에 닿지 않았다. dispatcher 는 성공을 돌려주고
 * 화면은 그대로였다.
 *
 * ADR-280 (2026-10-22): 옛 게이트는 binding `accepts` 를 봤고 delegating renderer 를 제외해
 * ListBox · GridList 의 미도달을 잡지 못했다 (Phase 0 RED 1). 상태 capability 는 이제 Preview
 * runtime 의 controlled helper (`catalog/runtime/runtimeStateProps.ts`) 가 record 의 runtime
 * 값으로 RAC 에 넘기므로 `accepts` 가 아니라 **render 결과** 가 판정이다 — 그 행렬이
 * `preview/catalog/__tests__/adr280Reach.test.tsx` 다. 여기서는 등록표의 모든 type 이 그 행렬
 * (또는 같은 경로를 도는 Phase 0 · Form 테스트) 에 들어 있는지를 정적으로 집행한다.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { CAPABILITY_REGISTRY } from "@composition/shared";

const TESTS = [
  "../../../../preview/catalog/__tests__/adr280Reach.test.tsx",
  "../../../../preview/catalog/__tests__/adr280Phase0.test.tsx",
  "../../../../preview/catalog/__tests__/adr280Form.test.tsx",
  // ADR-281 — a page root's · frame's inherited props (the Provider render + guard rows).
  "../../../../preview/catalog/__tests__/adr281Inheritance.test.tsx",
].map((path) => readFileSync(resolve(import.meta.dirname, path), "utf8"));

/**
 * Types the render matrix reaches through another palette entry (the palette names the trigger
 * tree after its body), or by the dispatcher's routing (a body's open is its trigger's).
 */
const REACHED_AS: Readonly<Record<string, string>> = {
  MenuTrigger: '"Menu"',
  DialogTrigger: '"Dialog"',
  TooltipTrigger: '"Tooltip"',
  // (An overlay body in a trigger: `stateOwnerOf` routes its open to the trigger — the trigger
  // rows above; a body alone takes its own `isOpen`.)
  Modal: '"Dialog"',
  Popover: '"Popover"',
  Tooltip: '"Tooltip"',
  // (A Menu's selection is the list inside the MenuTrigger's Popover — the collections row of
  // the same controlled helper; RangeCalendar · DateRangePicker values are `!event` objects.)
  Menu: '"ListBox"',
  RangeCalendar: '"Calendar"',
  DateRangePicker: '"DatePicker"',
  // (ADR-281 — the page root is the harness's body: its rows target it by capability.)
  body: '"disableAll"',
};

describe("capability prop 이 렌더 경로까지 닿는다 (ADR-280 G2)", () => {
  it("등록표의 capability 를 가진 모든 type 이 render 도달 행렬에 있다", () => {
    // (ADR-287 — a reference API Do writes a record prop that `withOverride` merges for every type;
    //   its reach is ADR-287 G2's — `adr287Reach.test.tsx`. This matrix is the concepts' state props.)
    const missing = Object.entries(CAPABILITY_REGISTRY)
      .filter(([, entry]) =>
        Object.values(entry.capabilities).some(
          (def) => !def.racRef.startsWith("catalog binding "),
        ),
      )
      .map(([type]) => type)
      .filter(
        (type) =>
          !TESTS.some((source) =>
            source.includes(REACHED_AS[type] ?? `"${type}"`),
          ),
      );
    expect(
      missing,
      "등재된 capability 가 render 결과로 검증되지 않았다 — adr280Reach.test.tsx 에 행을 더한다 " +
        "(binding 이 그 prop 을 RAC 에 넘기지 않으면 '눌렀는데 아무 일도 없다' 가 된다).",
    ).toEqual([]);
  });

  it("deferred 가 없다 — 보류 대신 전달 (ADR-280 G2)", () => {
    expect(
      Object.entries(CAPABILITY_REGISTRY).filter(
        ([, entry]) => entry.deferred?.length,
      ),
    ).toEqual([]);
  });
});
