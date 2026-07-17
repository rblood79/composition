import { describe, expect, it } from "vitest";

import { getPrimitiveBinding } from "../bindings";
import {
  componentCatalog,
  getCatalogCutoverTypes,
  getCatalogEntry,
} from "../componentCatalog";

/**
 * ADR-142 — componentCatalog 무결성 + family atomicity(불변식 D).
 * 6 registry 를 대체하는 단일 등록 SSOT 의 계약 검증.
 */
describe("componentCatalog — entry 무결성", () => {
  it("모든 primitive entry 의 binding 이 getPrimitiveBinding 과 일치", () => {
    for (const e of componentCatalog) {
      if (e.kind === "primitive") {
        expect(e.binding).toBe(getPrimitiveBinding(e.type));
      }
    }
  });

  it("reusable entry 는 reusableId 를 가진다 (family ① 은 reusable 없음)", () => {
    for (const e of componentCatalog) {
      if (e.kind === "reusable") {
        expect(typeof e.reusableId).toBe("string");
        expect(e.reusableId.length).toBeGreaterThan(0);
      }
    }
  });

  it("(kind, type) 복합 유일성 — 동일 kind 내 type 중복 없음", () => {
    // ADR-148 Phase 1: 동명 type 2-entry(Toolbar/Form primitive+reusable)가 설계상 허용되어
    //   전역 type 유일성에서 (kind,type) 복합 유일성으로 개정 (리뷰 round 2 m1). 동명 type 의
    //   palette 노출 단일성은 아래 placeable 단일성 test 가 커버.
    const keys = componentCatalog.map((e) => `${e.kind}:${e.type}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("동명 type 의 primitive/reusable 공존 시 placeable 은 reusable 한쪽만 (placeable 단일성)", () => {
    const byType = new Map<string, typeof componentCatalog>();
    for (const e of componentCatalog) {
      byType.set(e.type, [...(byType.get(e.type) ?? []), e]);
    }
    for (const [type, entries] of byType) {
      if (entries.length < 2) continue;
      const placeables = entries.filter((e) => e.panel.placeable);
      expect(
        placeables.length,
        `동명 type "${type}" 의 placeable entry 는 정확히 1개여야 함`,
      ).toBe(1);
      expect(placeables[0]?.kind).toBe("reusable");
    }
  });

  it("모든 entry 의 panel.placeable 정의", () => {
    for (const e of componentCatalog) {
      expect(typeof e.panel.placeable).toBe("boolean");
    }
  });
});

describe("componentCatalog — family atomicity (불변식 D)", () => {
  it("같은 family 의 모든 entry 는 cutover 값이 동일 (native 제외 — cutover 개념 없음)", () => {
    const byFamily = new Map<string, Set<string>>();
    for (const e of componentCatalog) {
      // composition-native(frame/Slot)는 cutover 필드 없음(metadata-only) → 불변식 D 무관.
      if (e.kind === "native") continue;
      if (!byFamily.has(e.family)) byFamily.set(e.family, new Set());
      byFamily.get(e.family)!.add(e.cutover);
    }
    for (const [family, cutoverValues] of byFamily) {
      expect(
        cutoverValues.size,
        `family "${family}" 에 혼재된 cutover: ${[...cutoverValues].join(", ")}`,
      ).toBe(1);
    }
  });
});

describe("componentCatalog — family ① (primitives) 구성", () => {
  it("family ① primitive 전부 등록 (ADR-148: 동명 reusable entry 는 별도 kind — 본 검사 제외)", () => {
    const fam1 = componentCatalog.filter(
      (e) => e.family === "primitives" && e.kind === "primitive",
    );
    const types = fam1.map((e) => e.type).sort();
    expect(types).toEqual(
      [
        "Badge",
        "Button",
        // ADR-912 단계 5 선행-1: catalog 미등록 leaf 등록
        "FileTrigger",
        "Icon",
        "Link",
        "Separator",
        // ADR-912 단계 5 선행-1: loading placeholder internal leaf
        "Skeleton",
        "ToggleButton",
        "ToggleButtonGroup",
        "Toolbar",
        // ADR-912 위험군 해소(선행-1/6): TEXT_LEAF + field/form/text leaf catalog 등록
        //   (HEAD 시점 본 배열에 누락된 stale — container shell 3 추가와 함께 actual 21 로 정합)
        "Text",
        "Heading",
        "Paragraph",
        "Code",
        "Kbd",
        "Label",
        "Description",
        "FieldError",
        // ADR-912 internal 4 slice (2026-06-04): 인라인 알림 box leaf (internal source)
        "InlineAlert",
        // ADR-912 진로 1번 (2026-06-06): 빈 상태(empty state) internal leaf (skiaPrimitive escape)
        "IllustratedMessage",
        // ADR-912 진로 1번 (2026-06-06): 상태 표시 dot+label internal leaf (status_light escape)
        "StatusLight",
        // ADR-912 진로 1번 (2026-06-06): 사용자 아바타 circle+image internal leaf (avatar escape)
        "Avatar",
        // ADR-912 진로 1번 (2026-06-06): 원형 진행률 internal leaf (value_fill_arc escape)
        "ProgressCircle",
        // ADR-912 선행-6 (2026-06-05): field 입력 영역 자식 leaf (rac source)
        "Input",
        // ADR-912 container shell 3 (2026-06-04): box형 시맨틱 컨테이너 leaf (internal source)
        "body",
        "Section",
        "Nav",
        // ADR-912 (B+icon) (2026-06-08): Disclosure/Calendar 헤더 leaf (leading/inline icon escape).
        //   이전 slice 에서 catalog 등록됐으나 본 oracle 미갱신 stale → §2-5 Disclosure slice 와 함께 정합.
        "DisclosureHeader",
        "CalendarHeader",
        // ADR-912 (A/2D) (2026-06-08): Calendar grid + DateField input leaf (calendar_month_grid /
        //   datefield_segments replace escape). 동일 stale 정합.
        "CalendarGrid",
        "DateInput",
        // ADR-912 §2-5 collapse 진입 proof (2026-06-10): Disclosure 컨테이너 shell entry.
        //   SHELL_ONLY → Skia generic 빈 shell, DOM=renderDisclosure 위임(DELEGATING).
        "Disclosure",
        // ADR-912 Disclosure 군 일괄 cutover (2026-06-10, f0ad8d03a): 패널 콘텐츠 leaf +
        //   그룹 컨테이너. catalog 등록됐으나 본 oracle 미갱신 stale → T1 Field slice 와 함께 정합.
        "DisclosureContent",
        "DisclosureGroup",
        // ADR-912 R5 childSpec→catalog 컨테이너 cutover (2026-06-15): Card 4 자식 슬롯 sub-part
        //   (R5 가 FAMILY_1 추가했으나 본 oracle 미갱신 stale).
        "CardHeader",
        "CardContent",
        "CardFooter",
        "CardPreview",
        // ADR-912 R6 (2026-06-15): Card 본체 S2 재설계 catalog cutover.
        "Card",
        // ADR-912 R7 G1-a/b (2026-06-15): container shell 3종 catalog cutover (AvatarGroup/
        //   CardView 빈 셸 동형 + TableView isQuiet→variant:quiet 흡수). Skia generic box shell.
        "AvatarGroup",
        "CardView",
        "TableView",
        // ADR-912 R7 G1-c (2026-06-15): Pagination 컨테이너 catalog cutover. factory 자식 Button×5
        //   자동생성 → _hasChildren=true → standalone 버튼군 dead, box shell 만 live (R7 G1 동형).
        "Pagination",
        // ADR-912 R7 G1-c (2026-06-15): ButtonGroup 컨테이너 catalog cutover. factory 자식 Button×2
        //   (Cancel/Save) 자동생성 → _hasChildren=true → standalone box 분기 dead, 투명 box shell 만
        //   live (Pagination/AvatarGroup 동형). variant default 전부 transparent.
        "ButtonGroup",
        // ADR-912 catalog cutover (TableView 자식 트리 Skia 대칭, 2026-06-25): TableView factory 가
        //   생성하는 canonical 자식 5종. catalog 미등록 시 buildSpecNodeData:994 에서 Skia scene node
        //   가 null 로 버려져 헤더/행/텍스트가 Skia 미렌더(Preview 는 renderTableView 직접 div). 등록으로
        //   isCatalogCutover → buildCatalogShapes box+text. PALETTE_ORDER 미포함(단독 배치 불가).
        "TableHeader",
        "TableBody",
        "Column",
        "Row",
        "Cell",
      ].sort(),
    );
    expect(fam1.every((e) => e.kind === "primitive")).toBe(true);
  });

  it("getCatalogEntry O(1) 조회", () => {
    expect(getCatalogEntry("Button")?.type).toBe("Button");
    expect(getCatalogEntry("Nonexistent")).toBeUndefined();
  });
});

describe("getCatalogCutoverTypes — cutover 게이트 파생", () => {
  it("cutover==='catalog' entry 만 반환 (native 제외)", () => {
    const cutoverTypes = getCatalogCutoverTypes();
    // native(frame/Slot)는 cutover 개념 없음 → 게이트 제외(metadata-only).
    // ADR-148: 동명 primitive/reusable(Toolbar/Form) 이 둘 다 cutover==="catalog" 라
    //   Set 파생과 비교 위해 dedup (중복 무해 — 인스턴스는 type:"ref" 라 게이트 무영향).
    const expectedCatalog = [
      ...new Set(
        componentCatalog
          .filter((e) => e.kind !== "native" && e.cutover === "catalog")
          .map((e) => e.type),
      ),
    ];
    expect([...cutoverTypes].sort()).toEqual(expectedCatalog.sort());
  });
});
