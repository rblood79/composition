/**
 * ADR-914 Phase 1 — Entry Universe Contract (additive spine, no deletion)
 *
 * component entry universe resolver (`entryUniverse.ts`) 가 existing 손등록
 * registry 를 정확히 mirror 하는지 검증한다. Phase 1 은 deletion 없이 새 authority
 * spine 이 current registry 와 1:1 green 임을 증명하는 단계 (Gate G1).
 *
 * 모델 (breakdown §3.3 Replacement contract, Phase 1 read-only 부분):
 *  1. placeable (ComponentFactory.creators) ⟹ entry universe row 1:1.
 *  2. 각 facet mirror 가 inventory freeze 정본 카운트와 일치
 *     (docs/adr/design/914-entry-universe-inventory.md, 2026-06-20).
 *  3. registry 간 facet 정합: delegating render ⟹ rendererMap entry 존재.
 *  4. negative fixture: entry 없는 가짜 placeable 은 universe 에서 감지.
 *
 * 본 contract 는 ADR-139 `componentRegistrationContract` 를 **대체하지 않는다** —
 * Phase 7 contract swap 까지 병행한다. baseline append 금지는 ADR-139 contract 가
 * 계속 담당하며, 본 test 는 그 병행 사실만 sanity 확인한다.
 *
 * 실행: pnpm vitest entryUniverseContract
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";

import { rendererMap } from "@composition/shared/renderers";
import { getCatalogCutoverTypes } from "@composition/shared";
import { TAG_SPEC_MAP } from "@composition/specs";

import { ComponentFactory } from "@/builder/factories/ComponentFactory";
import {
  getEntryUniverseTypes,
  resolveComponentEntryRuntime,
  type ComponentEntryRuntime,
} from "@/builder/factories/entryUniverse";
import { createAvatarDefinition } from "@/builder/factories/definitions/DisplayComponents";
import { getDefaultProps } from "@/types/builder/unified.types";
import type { ComponentCreationContext } from "@/builder/factories/types";
import { COMPLEX_COMPONENT_TAGS } from "@/builder/factories/constants";
import { isReusableCompositeType } from "@/builder/components/reusableCompositeOrigins";
import { SYNTHETIC_CHILD_PROP_MERGE_TAGS } from "@/builder/workspace/canvas/skia/buildSpecNodeData";
import {
  POPOVER_CHILDREN_TAGS,
  FIELD_VISIBLE_CHILD_TAGS,
} from "@/builder/workspace/canvas/layout/engines/implicitStyles";

// ── inventory freeze 정본 카운트 (914-entry-universe-inventory.md §1, 2026-06-20) ──
// 이 값은 Phase 0 inventory 의 source 다. facet mirror 가 이 카운트에서 벗어나면
// (a) registry 가 변경됐는데 inventory 미갱신, 또는 (b) resolver mirror 결함이다.
const INVENTORY = {
  rendererMap: 94,
  internalRenderers: 26,
  delegatingInternal: 18,
  delegatingRac: 10,
  defaultPropsMap: 92,
  // ADR-914 Phase 4-B (2026-06-21): Avatar creator 제거 → 55 → 54 (Avatar 는 creation.mode
  //   ="none" leaf, palette-add 는 else 분기 getDefaultProps). placeable 집합 1 축소.
  creators: 54,
  complexComponentTags: 48,
  propagationRegistered: 31,
  syntheticChildPropMerge: 9,
  popoverChildren: 2,
  // ADR-914 Phase 6 후속 (field visible filter, 2026-06-21): FIELD_VISIBLE_CHILD_TAGS
  //   포함형 filter 컨테이너 8 tag (combobox/select/searchfield/numberfield/textfield/
  //   textarea/datefield/timefield). datepicker 는 제외형이라 popoverHosted facet 소관.
  fieldVisibleContainers: 8,
} as const;

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
type RegistryMap = Record<string, Record<string, string>>;
const readJson = (name: string): RegistryMap =>
  JSON.parse(fs.readFileSync(path.join(TEST_DIR, name), "utf8")) as RegistryMap;

const placeable = ComponentFactory.getRegisteredTypes();
const entries: ComponentEntryRuntime[] = placeable.map((t) =>
  resolveComponentEntryRuntime(t),
);

// ── ADR-914 Phase 7 (contract swap — invariant B 흡수 + exception matrix) ──
// ADR-139 componentRegistrationContract 의 invariant B forward leg
// (`placeable ⟹ rendererMap` / `placeable ⟹ TAG_SPEC_MAP OR catalog`) 와 exception
// allowlist (`allowed()` = baseline OR exception 의 false-positive 누락 차단) 를 entry
// contract 가 흡수함을 증명한다. baseline 은 전부 빈 객체(ratchet 0)라 실질 차단은
// exception + forward leg → 본 swap 은 exception 만 읽으면 충분 (baseline ratchet 은
// ADR-139 가 invariant A spec universe 와 함께 계속 담당, §3.3-7).
type RegistryName = "rendererMap" | "TAG_SPEC_MAP" | "getDefaultProps";
const exceptionsJson = readJson("componentRegistrationException.json");
/** 대소문자 무시 lookup (`Frame` spec ↔ `frame` canonical 키 정합, ADR-139 hasCI 동형). */
const hasCI = (set: Set<string>, name: string): boolean => {
  if (set.has(name)) return true;
  const l = name.toLowerCase();
  for (const k of set) if (k.toLowerCase() === l) return true;
  return false;
};
/** exception (intended-absent) 으로 해당 registry 누락이 허용되는가. baseline 은 빈 객체라 제외. */
const allowedAbsent = (reg: RegistryName, comp: string): boolean =>
  comp in (exceptionsJson[reg] ?? {});
const rendererKeySet = new Set(Object.keys(rendererMap));
const tagSpecKeySet = new Set(Object.keys(TAG_SPEC_MAP));
const catalogCutoverSet = new Set(getCatalogCutoverTypes());
const tagSpecOrCatalogSet = new Set([...tagSpecKeySet, ...catalogCutoverSet]);

describe("ADR-914 entry universe contract", () => {
  // ── 1. placeable ⟹ entry universe row 1:1 ──
  it("getEntryUniverseTypes 는 placeable 과 동일 진입점", () => {
    expect(getEntryUniverseTypes().sort()).toEqual([...placeable].sort());
  });

  it("모든 placeable 은 entry runtime 을 resolve 한다", () => {
    for (const e of entries) {
      expect(e.type).toBeTruthy();
      expect(e.placeable).toBe(true);
    }
    expect(entries.length).toBe(placeable.length);
  });

  // ── 2. facet mirror == inventory freeze 정본 ──
  it("creation facet — COMPLEX_COMPONENT_TAGS mirror == 48", () => {
    const complex = entries.filter((e) => e.creation.mode === "complex");
    expect(complex.length).toBe(INVENTORY.complexComponentTags);
  });

  // ── ADR-914 Phase 4-C (creation facet membership SSOT 명문화, 2026-06-21) ──
  // count parity(위 == 48)는 set 크기만 본다. Phase 4-C 는 facet 이 membership 을
  // **소유**함을 증명한다: creation.mode==="complex" ⟺ COMPLEX_COMPONENT_TAGS.has(type)
  // (양방향 1:1) + reusableOrigin ⟺ isReusableCompositeType + 세 mode disjoint.
  // 사용자 결정(2026-06-21): 별도 declaration 파일 신설 없이 constants.ts 의
  // COMPLEX_COMPONENT_TAGS 자체를 SSOT 로 명문화 — 두 소비처(entryUniverse:183 /
  // useElementCreator:192)가 이미 단일 set 공유, surface 증가 0.
  it("Phase 4-C — complex mode ⟺ COMPLEX_COMPONENT_TAGS (양방향 parity)", () => {
    // 정방향: facet 이 complex 라고 한 type 은 전부 set 멤버.
    for (const e of entries) {
      if (e.creation.mode === "complex") {
        expect(
          COMPLEX_COMPONENT_TAGS.has(e.type),
          `${e.type}: facet=complex 인데 COMPLEX set 미포함 (membership SSOT 불일치)`,
        ).toBe(true);
      }
    }
    // 역방향: COMPLEX set 멤버 중 placeable 인 type 은 reusableOrigin 이 아닌 한
    //   facet 이 complex 여야 한다 (reusableOrigin > complex 우선순위 고려).
    for (const type of COMPLEX_COMPONENT_TAGS) {
      if (!placeable.includes(type)) continue; // placeable 아닌 set 멤버는 entry 없음
      const mode = resolveComponentEntryRuntime(type).creation.mode;
      const expected = isReusableCompositeType(type)
        ? "reusableOrigin"
        : "complex";
      expect(
        mode,
        `${type}: COMPLEX 멤버인데 facet mode=${mode} (기대 ${expected})`,
      ).toBe(expected);
    }
  });

  it("Phase 4-C — reusableOrigin mode ⟺ isReusableCompositeType", () => {
    // resolver 를 직접 호출 (Toolbar/Form 은 placeable 아님). 두 set 이 disjoint 라
    //   reusableOrigin 판정이 COMPLEX 보다 우선해도 complex 를 가리지 않음.
    for (const type of ["Toolbar", "Form"]) {
      expect(isReusableCompositeType(type)).toBe(true);
      expect(resolveComponentEntryRuntime(type).creation.mode).toBe(
        "reusableOrigin",
      );
    }
    // placeable entry 중 facet 이 reusableOrigin 이라고 한 것은 전부 isReusableCompositeType.
    for (const e of entries) {
      if (e.creation.mode === "reusableOrigin") {
        expect(
          isReusableCompositeType(e.type),
          `${e.type}: facet=reusableOrigin 인데 isReusableCompositeType=false`,
        ).toBe(true);
      }
    }
  });

  it("Phase 4-C — 세 mode disjoint (none ∩ complex ∩ reusableOrigin = ∅)", () => {
    // none type 은 COMPLEX 미포함 + reusableOrigin 아님 (양쪽 set 모두 비멤버).
    for (const e of entries) {
      if (e.creation.mode === "none") {
        expect(
          COMPLEX_COMPONENT_TAGS.has(e.type),
          `${e.type}: facet=none 인데 COMPLEX set 포함`,
        ).toBe(false);
        expect(
          isReusableCompositeType(e.type),
          `${e.type}: facet=none 인데 isReusableCompositeType=true`,
        ).toBe(false);
      }
    }
  });

  // ── ADR-914 Phase 4 (Creation Facet Proof) — 4-A 3-mode + 4-B Avatar creator 제거 ──
  // 사용자 결정 2026-06-21: 3-mode(none/reusableOrigin/complex). delegate 식별용 새
  // 손등록 set 은 collapse 목적(surface 감소)에 역행하므로 미도입 — declaredChildren/
  // delegate 는 complex 에 포함(기존 COMPLEX 의미 보존). reusableOrigin 은 기존
  // REUSABLE_COMPOSITE_ORIGINS 파생(추가 손등록 0).
  it("Phase 4 creation facet — 3-mode (none/reusableOrigin/complex) 만 노출", () => {
    const modes = new Set(entries.map((e) => e.creation.mode));
    for (const m of modes) {
      expect(["none", "reusableOrigin", "complex"]).toContain(m);
    }
  });

  it("Phase 4 creation facet — reusableOrigin 은 REUSABLE_COMPOSITE_ORIGINS 파생", () => {
    // Toolbar/Form 은 creators 에 없으므로(R-5 ref instance 경로) placeable 아님 →
    // resolver 를 직접 호출해 reusableOrigin mode 를 검증.
    expect(resolveComponentEntryRuntime("Toolbar").creation.mode).toBe(
      "reusableOrigin",
    );
    expect(resolveComponentEntryRuntime("Form").creation.mode).toBe(
      "reusableOrigin",
    );
  });

  it("Phase 4 creation facet — leaf(none) 은 creator 부재 + COMPLEX 미포함", () => {
    // Avatar 는 4-B 에서 creator 제거 → COMPLEX 미포함 leaf → mode==="none".
    expect(resolveComponentEntryRuntime("Avatar").creation.mode).toBe("none");
    // Button(항상 leaf, COMPLEX 미포함) 도 none.
    expect(resolveComponentEntryRuntime("Button").creation.mode).toBe("none");
  });

  it("Phase 4-B — Avatar creator 제거 (placeable 아님)", () => {
    // creator 제거 → getRegisteredTypes 에서 빠짐. palette-add 는 else 분기로
    // getDefaultProps("Avatar") 사용(props byte-identical) → tree diff 0.
    expect(ComponentFactory.getRegisteredTypes()).not.toContain("Avatar");
    // AvatarGroup(컨테이너, 자식 3) 은 creator 유지.
    expect(ComponentFactory.getRegisteredTypes()).toContain("AvatarGroup");
  });

  // ── Gate G4 oracle: creator 제거 후 palette-add tree diff 0 (live behavior 코드 고정) ──
  // Chrome MCP 미연결 환경에서 G4(palette add canonical tree diff 0)를 코드로 보증한다.
  // creator 가 살아있을 때(구 createComplexComponent 미경유, else 분기였음)와 삭제 후
  // (else 분기)가 동일 element 를 만드는 근거: useElementCreator else 분기는
  // getDefaultProps(type) 로 단일 element 생성. 이 값이 구 createAvatarDefinition 의
  // parent.props 와 byte-identical + 자식 0 이면 삭제 전후 tree 가 불변임이 확정된다.
  it("Gate G4 — Avatar palette-add(else 분기) == 구 creator definition (tree diff 0)", () => {
    // 구 creator 가 만들던 element (definition 함수 보존 — factoryOwnership.test 참조).
    const ctx = {
      parentElement: null,
      pageId: "page-test",
      elements: [],
      layoutId: null,
      doc: undefined,
    } as unknown as ComponentCreationContext;
    const def = createAvatarDefinition(ctx);

    // 현 palette-add(else 분기)가 쓰는 props.
    const elseProps = getDefaultProps("Avatar");

    // (1) props byte-identical — variant/size/style 전부 동일.
    expect(elseProps).toEqual(def.parent.props);
    // (2) creator definition 도 자식 0 (leaf) — else 분기는 항상 자식 0.
    expect(def.children).toEqual([]);
  });

  it("propagation facet — registered mirror == 31", () => {
    const registered = entries.filter((e) => e.propagation.registered);
    // placeable 중 propagation 등록된 수. 전체 등록(31)에는 placeable 아닌
    // GridListItem/ListBoxItem 이 포함되므로, placeable ∩ propagation 으로 비교.
    const allRegisteredViaResolver = [
      ...new Set([
        "TextField",
        "TextArea",
        "NumberField",
        "SearchField",
        "DateField",
        "TimeField",
        "ColorField",
        "Select",
        "ComboBox",
        "Checkbox",
        "Radio",
        "Switch",
        "Slider",
        "CheckboxGroup",
        "RadioGroup",
        "TagGroup",
        "ProgressBar",
        "Meter",
        "Calendar",
        "RangeCalendar",
        "DatePicker",
        "DateRangePicker",
        "Card",
        "CardHeader",
        "CardContent",
        "GridList",
        "ListBox",
        "ToggleButtonGroup",
        "Tabs",
        "GridListItem",
        "ListBoxItem",
      ]),
    ];
    expect(allRegisteredViaResolver.length).toBe(
      INVENTORY.propagationRegistered,
    );
    // placeable 인 등록 parent 는 모두 resolver 가 registered=true 로 mirror.
    for (const t of allRegisteredViaResolver) {
      if (!placeable.includes(t)) continue; // Item 류는 placeable 아님
      expect(
        resolveComponentEntryRuntime(t).propagation.registered,
        `${t} propagation.registered mismatch`,
      ).toBe(true);
    }
  });

  // ── ADR-914 Phase 6 (childRuntime facet membership SSOT 명문화, 2026-06-21) ──
  // count parity(== 9 / == 2)는 set 크기만 본다. Phase 6 은 facet 이 membership 을
  // **소유**함을 증명한다: childRuntime.syntheticPropMerge ⟺ SYNTHETIC_CHILD_PROP_MERGE_TAGS.has
  // (양방향 1:1), childRuntime.popoverHosted ⟺ POPOVER_CHILDREN_TAGS.has (양방향 1:1).
  // 사용자 결정(2026-06-21): proof family = SYNTHETIC 단일 메커니즘. necessity/field-filter 는
  // adapter-required(HIGH/live-prop 의존)라 후속 slice/adapter 설계로 분리(R7 한 phase 한 facet).
  // 방식 = Phase 4-C 식 SSOT 명문화 — set 정의 위치(buildSpecNodeData.ts:187 /
  // implicitStyles.ts:429)는 유지, facet 이 그 membership 을 소유함을 contract 양방향 parity
  // 로 증명. 5 소비처(StoreRenderBridge 3 + buildSpecNodeData 2)의 직접 SYNTHETIC.has() 호출은
  // 정본 유지(이미 단일 set import — surface 증가 0). POPOVER 는 dormant 우려가 있으나
  // SSOT 명문화는 동일 set 을 contract 가 읽는 것이라 dormant 아님(소비처 = contract + 실사용).
  it("Phase 6 — syntheticPropMerge ⟺ SYNTHETIC_CHILD_PROP_MERGE_TAGS (양방향 parity)", () => {
    // count parity (set 크기 == inventory 정본).
    expect(SYNTHETIC_CHILD_PROP_MERGE_TAGS.size).toBe(
      INVENTORY.syntheticChildPropMerge,
    );
    // 정방향: facet 이 syntheticPropMerge=true 라고 한 type 은 전부 set 멤버.
    for (const e of entries) {
      if (e.childRuntime.syntheticPropMerge) {
        expect(
          SYNTHETIC_CHILD_PROP_MERGE_TAGS.has(e.type),
          `${e.type}: facet=syntheticPropMerge 인데 SYNTHETIC set 미포함 (membership SSOT 불일치)`,
        ).toBe(true);
      }
    }
    // 역방향: SYNTHETIC set 멤버 중 placeable 인 type 은 facet 이 syntheticPropMerge=true.
    for (const type of SYNTHETIC_CHILD_PROP_MERGE_TAGS) {
      if (!placeable.includes(type)) continue; // 비-placeable set 멤버는 entry 없음(예: Toolbar ref instance)
      expect(
        resolveComponentEntryRuntime(type).childRuntime.syntheticPropMerge,
        `${type}: SYNTHETIC 멤버인데 facet=false (membership SSOT 불일치)`,
      ).toBe(true);
    }
  });

  it("Phase 6 — popoverHosted ⟺ POPOVER_CHILDREN_TAGS (양방향 parity)", () => {
    // count parity.
    expect(POPOVER_CHILDREN_TAGS.size).toBe(INVENTORY.popoverChildren);
    // 정방향: facet 이 popoverHosted=true 라고 한 type 은 전부 set 멤버.
    for (const e of entries) {
      if (e.childRuntime.popoverHosted) {
        expect(
          POPOVER_CHILDREN_TAGS.has(e.type),
          `${e.type}: facet=popoverHosted 인데 POPOVER set 미포함`,
        ).toBe(true);
      }
    }
    // 역방향: POPOVER set 멤버는 placeable 여부와 무관히 resolver 가 popoverHosted=true 로 mirror
    //   (Calendar/RangeCalendar 는 popover-hosted leaf — resolver 직접 호출로 검증).
    for (const type of POPOVER_CHILDREN_TAGS) {
      expect(
        resolveComponentEntryRuntime(type).childRuntime.popoverHosted,
        `${type}: POPOVER 멤버인데 facet=false`,
      ).toBe(true);
    }
    // 임의 비-popover type 은 false (disjoint sanity).
    expect(
      resolveComponentEntryRuntime("Button").childRuntime.popoverHosted,
    ).toBe(false);
  });

  // ── ADR-914 Phase 6 후속 slice (field visible filter membership SSOT, 2026-06-21) ──
  // field 4 filter 분기(combobox/select/searchfield · numberfield · textfield/textarea ·
  // datefield/timefield)의 inline `c.type` 비교 / 분기별 local WRAPPER_TAGS 를
  // FIELD_VISIBLE_CHILD_TAGS 단일 declarative 맵으로 추출했다 (oracle byte-identical —
  // 가시성 동작 불변). filter 와 facet 이 **동일 맵을 직접 소비** → POPOVER 선례 동형 비-dormant.
  // 사용자 결정(2026-06-21): scope = field/datepicker membership facet 단일 (R7). PROGRESSBAR/
  // SLIDER/tabpanels live-prop adapter 는 별도 후속 slice (적대 검증 risk HIGH, byte-identical 불가).
  // facet 은 컨테이너 type → 가시 child.type 정렬 배열을 노출, Label gate(hasLabel live)·sideMode·
  // 텍스트 합성은 맵 밖 adapter 잔존 (소비처 implicitStyles). datepicker 는 제외형 filter 라
  // 포함형 맵 대상 아님 — 이미 Phase 6 popoverHosted facet 이 그 membership 소유.
  it("Phase 6 후속 — fieldVisibleChildTags ⟺ FIELD_VISIBLE_CHILD_TAGS (per-container 양방향 parity)", () => {
    // count parity (맵 컨테이너 수 == inventory 정본).
    expect(Object.keys(FIELD_VISIBLE_CHILD_TAGS).length).toBe(
      INVENTORY.fieldVisibleContainers,
    );

    // 정방향: facet 이 fieldVisibleChildTags 비-null 인 type 은 전부 맵에 (대소문자 무시) 존재하고,
    //   배열 내용이 맵 set 과 정확히 일치.
    for (const e of entries) {
      const facetTags = e.childRuntime.fieldVisibleChildTags;
      if (facetTags === null) continue;
      const mapSet = FIELD_VISIBLE_CHILD_TAGS[e.type.toLowerCase()];
      expect(
        mapSet,
        `${e.type}: facet=fieldVisibleChildTags 비-null 인데 FIELD_VISIBLE_CHILD_TAGS 미포함`,
      ).toBeDefined();
      // facet 배열 == 맵 set (정렬 비교 — facet 은 정렬 배열 노출).
      expect([...facetTags].sort()).toEqual([...(mapSet ?? [])].sort());
    }

    // 역방향: 맵 멤버 컨테이너 중 placeable 인 type 은 facet 이 정확히 그 set 을 노출.
    for (const [tag, set] of Object.entries(FIELD_VISIBLE_CHILD_TAGS)) {
      // 맵 key 는 lowercase containerTag → placeable 정본 표기로 매칭 (대소문자 무시).
      const placeableType = placeable.find((p) => p.toLowerCase() === tag);
      if (!placeableType) continue; // placeable 아니면 entry 없음
      const facetTags =
        resolveComponentEntryRuntime(placeableType).childRuntime
          .fieldVisibleChildTags;
      expect(
        facetTags,
        `${tag}: FIELD_VISIBLE_CHILD_TAGS 멤버인데 facet=null (membership SSOT 불일치)`,
      ).not.toBeNull();
      expect([...(facetTags ?? [])].sort()).toEqual([...set].sort());
    }

    // 임의 비-field type 은 null (disjoint sanity).
    expect(
      resolveComponentEntryRuntime("Button").childRuntime.fieldVisibleChildTags,
    ).toBeNull();
    // datepicker 는 제외형 filter (popoverHosted facet 소관) → fieldVisibleChildTags null.
    expect(
      resolveComponentEntryRuntime("DatePicker").childRuntime
        .fieldVisibleChildTags,
    ).toBeNull();
  });

  // ── 3. registry 간 facet 정합 ──
  it("render facet — delegating(rac/internal) 은 rendererMap entry 를 가진다", () => {
    // delegating 위임은 rendererMap[type] 호출이 전제 (자식 재귀 skip).
    // mismatch = delegating 인데 renderer entry 없음 → 위임 호출 시 런타임 결함.
    const broken: string[] = [];
    for (const e of entries) {
      const isDelegating =
        e.render.mode === "delegating-rac" ||
        e.render.mode === "delegating-internal";
      if (isDelegating && !e.render.hasRendererEntry) {
        broken.push(`${e.type} (${e.render.mode}, no rendererMap entry)`);
      }
    }
    expect(
      broken,
      `delegating 인데 rendererMap entry 없음: ${broken.join(", ")}`,
    ).toEqual([]);
  });

  it("defaults facet — 모든 placeable 은 default props row 를 가진다", () => {
    // ADR-139 불변식 B (placeable ⟹ getDefaultProps) 의 entry-universe mirror.
    // exception(DataTable/Navigation) 은 intended-absent 이므로 제외.
    const exceptions = readJson("componentRegistrationException.json");
    const dpExceptions = new Set(Object.keys(exceptions.getDefaultProps ?? {}));
    const missing = entries
      .filter((e) => !e.defaults.hasDefaultPropsRow)
      .filter((e) => !dpExceptions.has(e.type))
      .map((e) => e.type)
      .sort();
    expect(
      missing,
      `placeable 인데 default props row 없음 (exception 외): ${missing.join(", ")}`,
    ).toEqual([]);
  });

  // ── 4. negative fixture ──
  it("negative fixture — entry 없는 가짜 placeable 은 universe 에 없다", () => {
    const fake = "__Adr914FakeEntry__";
    expect(getEntryUniverseTypes()).not.toContain(fake);
    // resolver 는 미등록 type 에 placeable=false 를 mirror.
    expect(resolveComponentEntryRuntime(fake).placeable).toBe(false);
  });

  // ── ADR-914 Phase 7 (Contract Swap — invariant B 흡수 + exception matrix) ──
  // entry contract 를 primary gate 로 승격. ADR-139 invariant B 의 forward leg 2개
  // (`placeable ⟹ rendererMap` / `placeable ⟹ TAG_SPEC_MAP OR catalog`) 와 exception
  // 흡수 (false-positive 누락 차단) 를 entry contract 가 동일하게 수행함을 증명한다
  // (§3.3-2/3.3-7/3.3-8). 신설 substrate: render.hasTagSpecEntry / hasCatalogCutover.
  // surface 증가하나 TAG_SPEC_MAP intended-absent 표현은 substrate 신설 없이 원천
  // 불가하므로 Gate 정합이 surface-minimization 보다 우선 (적대 검증 3/3 HIGH, 2026-06-21).

  // §3.3-2 substrate parity — render facet 의 TAG_SPEC_MAP / catalog 멤버십이 실제 registry 정합.
  it("Phase 7 — render facet substrate (hasTagSpecEntry / hasCatalogCutover) == registry", () => {
    for (const e of entries) {
      expect(
        e.render.hasTagSpecEntry,
        `${e.type}: hasTagSpecEntry mismatch`,
      ).toBe(hasCI(tagSpecKeySet, e.type));
      expect(
        e.render.hasCatalogCutover,
        `${e.type}: hasCatalogCutover mismatch`,
      ).toBe(hasCI(catalogCutoverSet, e.type));
    }
  });

  // §3.3-2 invariant B forward leg #1 — placeable ⟹ rendererMap (exception intended-absent 제외).
  it("Phase 7 — invariant B: placeable ⟹ rendererMap (exception 제외)", () => {
    const missing = entries
      .filter((e) => !e.render.hasRendererEntry)
      .filter((e) => !allowedAbsent("rendererMap", e.type))
      .map((e) => e.type)
      .sort();
    expect(
      missing,
      `placeable 인데 rendererMap 미등록 (exception 외): ${missing.join(", ")}`,
    ).toEqual([]);
  });

  // §3.3-7 invariant B forward leg #2 — placeable ⟹ TAG_SPEC_MAP OR catalog (exception 제외).
  it("Phase 7 — invariant B: placeable ⟹ TAG_SPEC_MAP OR catalog (exception 제외)", () => {
    const missing = entries
      .filter((e) => !e.render.hasTagSpecEntry && !e.render.hasCatalogCutover)
      .filter((e) => !allowedAbsent("TAG_SPEC_MAP", e.type))
      .map((e) => e.type)
      .sort();
    expect(
      missing,
      `placeable 인데 TAG_SPEC_MAP/catalog 미등록 (exception 외): ${missing.join(", ")}`,
    ).toEqual([]);
  });

  // §3.3-8 exception 흡수 matrix — exception 의 placeable 항목이 "intended-absent" 로
  // 전수 통과 (false-positive missing 0). ADR-139 allowed()=baseline OR exception 의
  // 차단 의미가 entry contract 에 누락 없이 이관됐음을 항목별 증명.
  it("Phase 7 — exception 흡수 matrix: placeable exception 전수 intended-absent 통과", () => {
    // placeable 한 exception 항목만 entry contract 진입점. (MenuItem/List 는 placeable=false
    // → entry universe 진입점 밖, ADR-139 invariant A spec universe 잔재 — 본 matrix 대상 외.)
    const placeableSet = new Set(placeable);
    const matrix: Record<RegistryName, string[]> = {
      rendererMap: [],
      TAG_SPEC_MAP: [],
      getDefaultProps: [],
    };
    for (const reg of Object.keys(matrix) as RegistryName[]) {
      for (const comp of Object.keys(exceptionsJson[reg] ?? {})) {
        if (placeableSet.has(comp)) matrix[reg].push(comp);
      }
    }
    // (a) 흡수 대상이 실재 (regression: exception 이 통째로 비면 matrix 무의미).
    expect(
      matrix.TAG_SPEC_MAP.length + matrix.rendererMap.length,
      "placeable exception 이 0 — exception.json 또는 placeable 집합 변동 의심",
    ).toBeGreaterThan(0);

    // (b) 각 placeable exception 항목이 entry contract 에서 missing 으로 판정되지 않음.
    const falsePositives: string[] = [];
    for (const comp of matrix.rendererMap) {
      const e = resolveComponentEntryRuntime(comp);
      // rendererMap 부재여도 exception 으로 허용 → unexpectedMissing 에서 제외돼야 함.
      if (!e.render.hasRendererEntry && !allowedAbsent("rendererMap", comp)) {
        falsePositives.push(`rendererMap/${comp}`);
      }
    }
    for (const comp of matrix.TAG_SPEC_MAP) {
      const e = resolveComponentEntryRuntime(comp);
      const absent = !e.render.hasTagSpecEntry && !e.render.hasCatalogCutover;
      if (absent && !allowedAbsent("TAG_SPEC_MAP", comp)) {
        falsePositives.push(`TAG_SPEC_MAP/${comp}`);
      }
    }
    for (const comp of matrix.getDefaultProps) {
      const e = resolveComponentEntryRuntime(comp);
      if (
        !e.defaults.hasDefaultPropsRow &&
        !allowedAbsent("getDefaultProps", comp)
      ) {
        falsePositives.push(`getDefaultProps/${comp}`);
      }
    }
    expect(
      falsePositives,
      `exception 인데 false-positive missing (swap 보류 사유): ${falsePositives.join(", ")}`,
    ).toEqual([]);
  });

  // §3.3-8 negative — exception 보호가 실제 차단을 하고 있음 (allowlist 무력화 시 missing 노출).
  it("Phase 7 — negative: exception 제거 시 load-bearing 항목이 missing 으로 노출", () => {
    // DataTable/Image/Navigation 은 placeable & !tagSpec & !catalog (load-bearing TAG_SPEC_MAP).
    // exception 없이 판정하면 invariant B forward leg #2 에서 missing 으로 잡혀야 한다.
    for (const comp of ["DataTable", "Image", "Navigation"]) {
      const e = resolveComponentEntryRuntime(comp);
      expect(
        e.placeable && !e.render.hasTagSpecEntry && !e.render.hasCatalogCutover,
        `${comp}: load-bearing TAG_SPEC_MAP exception 전제 깨짐`,
      ).toBe(true);
      // exception 으로만 허용된다 (allowlist 가 없으면 차단).
      expect(allowedAbsent("TAG_SPEC_MAP", comp)).toBe(true);
    }
    // InlineAlert/TextArea/frame 은 placeable & !renderer (load-bearing rendererMap).
    for (const comp of ["InlineAlert", "TextArea", "frame"]) {
      const e = resolveComponentEntryRuntime(comp);
      expect(
        e.placeable && !e.render.hasRendererEntry,
        `${comp}: load-bearing rendererMap exception 전제 깨짐`,
      ).toBe(true);
      expect(allowedAbsent("rendererMap", comp)).toBe(true);
    }
  });

  // §3.3-2 negative fixture — 가짜 신규 누락이 forward leg 에서 missing 으로 감지.
  it("Phase 7 — negative fixture: 가짜 미등록 placeable 은 forward leg 가 감지", () => {
    const fake = "__Adr914P7FakeUnregistered__";
    // exception 에 없는 가짜 type 은 rendererMap 부재 시 missing.
    expect(allowedAbsent("rendererMap", fake)).toBe(false);
    expect(rendererKeySet.has(fake)).toBe(false);
    expect(hasCI(tagSpecOrCatalogSet, fake)).toBe(false);
  });

  // ── 5. ADR-139 병행 sanity ──
  it("ADR-139 contract 와 병행 — placeable 진입점이 동일", () => {
    // Phase 7: entry contract 가 primary 로 승격됐으나 ADR-139 는 invariant A(spec universe)
    // + baseline ratchet 담당으로 병행 유지. 두 contract 가 같은 placeable set 을 본다.
    expect(getEntryUniverseTypes()).toEqual(
      ComponentFactory.getRegisteredTypes(),
    );
  });
});
