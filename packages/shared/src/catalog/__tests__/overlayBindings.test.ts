import { describe, expect, it } from "vitest";

import { getPrimitiveBinding } from "../bindings";
import { getCatalogCutoverTypes, getCatalogEntry } from "../componentCatalog";
import { isCatalogCutover } from "../cutover";
import { toRacProps } from "../outputs/toRacProps";

/**
 * ADR-142 family ⑥(overlays) — Dialog/Modal/Popover/Tooltip/DropZone 계약 검증.
 *
 * overlay 는 composition wrapper(OverlayArrow / focus trap / drop 영역 합성, internal source).
 *
 * **ADR-912 단계 5 (1b) + step 1 (2026-06-04) — 5 overlay 전부 Skia generic 전환 (skiaLegacy 0건)**:
 * Popover bg/border buildCatalogShapes + V-arrow skiaPrimitive(popover_arrow),
 * Dialog bg + backdrop(overlay_backdrop), Modal transparent shell(primitive 없음),
 * DropZone variant+dashed border 보편 D3 속성, Tooltip bg+text generic + arrow(tooltip_arrow, append).
 * Toast 는 imperative API → 제외.
 *
 * **ADR-166 Phase 4 (2026-07-25)**: shadow primitive 2건(`popover_shadow`/`dialog_shadow`) 은퇴.
 * 그림자는 catalog `containerStyles.boxShadow` = `{shadow.*}` TokenRef 를 Skia 가 theme-aware 로
 * 소비하는 단일 채널이 담당한다.
 */

const OVERLAY_TYPES = [
  "Dialog",
  "Modal",
  "Popover",
  "Tooltip",
  "DropZone",
] as const;

/** Skia generic 발효된 overlay (skiaLegacy 0건 — 5 전부). */
const SKIA_CUTOVER_OVERLAYS = [
  "Popover",
  "Dialog",
  "Modal",
  "DropZone",
  "Tooltip",
] as const;

describe("family ⑥ overlays — catalog 등록 + cutover 상태", () => {
  it("5 overlay 가 catalog primitive entry (family=overlays, cutover=catalog)", () => {
    for (const type of OVERLAY_TYPES) {
      const entry = getCatalogEntry(type);
      expect(entry, `${type} catalog entry`).toBeDefined();
      expect(entry?.kind).toBe("primitive");
      expect(entry?.family).toBe("overlays");
      expect((entry as { cutover?: string } | undefined)?.cutover).toBe(
        "catalog",
      );
    }
  });

  it("5 overlay entry 에 skiaLegacy 속성 0건 (단계 5 step 1 — 필드 제거)", () => {
    for (const type of OVERLAY_TYPES) {
      const entry = getCatalogEntry(type);
      expect(
        (entry as { skiaLegacy?: boolean })?.skiaLegacy,
        `${type} skiaLegacy undefined`,
      ).toBeUndefined();
    }
  });

  it("cutover 게이트가 5 overlay 전부 포함 (skiaLegacy 0건)", () => {
    const gate = getCatalogCutoverTypes();
    for (const type of OVERLAY_TYPES) {
      expect(gate.has(type), `${type} in cutover gate`).toBe(true);
    }
  });

  it("overlay binding 은 internal source. shadow/arrow 패턴 보유 overlay 만 skiaPrimitive", () => {
    for (const type of OVERLAY_TYPES) {
      const binding = getPrimitiveBinding(type);
      expect(binding?.source.kind, `${type} source`).toBe("internal");
    }
    // Modal(발효이나 shadow/arrow 없음 — transparent shell) + DropZone(variant 보편 속성) 은 미보유.
    for (const type of ["Modal", "DropZone"]) {
      expect(
        getPrimitiveBinding(type)?.skiaPrimitive,
        `${type} no skiaPrimitive`,
      ).toBeUndefined();
    }
    // ADR-166 Phase 4 (2026-07-25): shadow primitive 2건 은퇴 — 그림자는 catalog
    //   `containerStyles.boxShadow` 단일 채널. arrow/backdrop 만 primitive 로 남는다
    //   (box-shadow 로 표현 불가한 형상이라 존치가 정당).
    expect(getPrimitiveBinding("Popover")?.skiaPrimitive).toEqual([
      "popover_arrow",
    ]);
    expect(getPrimitiveBinding("Dialog")?.skiaPrimitive).toEqual([
      "overlay_backdrop",
    ]);
    // Tooltip — V-arrow(showArrow=true 한정) append escape (단계 5 (1b)).
    expect(getPrimitiveBinding("Tooltip")?.skiaPrimitive).toBe("tooltip_arrow");
  });

  it("Toast 는 순수 box-shell catalog cutover (R7 G1-c, RAC 정본 — accent bar 없음)", () => {
    // ADR-912 R7 G1-c (2026-06-15): factory createToastDefinition 가 Heading/Description 자식 자동
    //   생성 → 런타임 항상 _hasChildren=true → box-shell(Pagination 동형). 구 spec 좌측 accent bar 는
    //   RAC 공식 Toast 미준수 변형이라 제거 — skiaPrimitive 없는 순수 box shell.
    expect(isCatalogCutover("Toast")).toBe(true);
    expect(getPrimitiveBinding("Toast")?.skiaPrimitive).toBeUndefined();
  });

  it("toRacProps: Dialog size data-* + isDismissable 통과", () => {
    const result = toRacProps(
      {
        id: "dlg1",
        type: "Dialog",
        props: { size: "lg", isDismissable: true },
      },
      getPrimitiveBinding("Dialog")!,
    );
    expect(result["data-size"]).toBe("lg");
    expect(result.isDismissable).toBe(true);
  });

  it("toRacProps: Popover hideArrow 통과 + size default", () => {
    const result = toRacProps(
      { id: "pop1", type: "Popover", props: { hideArrow: true } },
      getPrimitiveBinding("Popover")!,
    );
    expect(result.hideArrow).toBe(true);
    expect(result["data-size"]).toBe("md");
  });
});
