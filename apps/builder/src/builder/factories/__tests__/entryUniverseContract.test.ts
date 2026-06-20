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

import { ComponentFactory } from "@/builder/factories/ComponentFactory";
import {
  getEntryUniverseTypes,
  resolveComponentEntryRuntime,
  type ComponentEntryRuntime,
} from "@/builder/factories/entryUniverse";

// ── inventory freeze 정본 카운트 (914-entry-universe-inventory.md §1, 2026-06-20) ──
// 이 값은 Phase 0 inventory 의 source 다. facet mirror 가 이 카운트에서 벗어나면
// (a) registry 가 변경됐는데 inventory 미갱신, 또는 (b) resolver mirror 결함이다.
const INVENTORY = {
  rendererMap: 94,
  internalRenderers: 26,
  delegatingInternal: 18,
  delegatingRac: 10,
  defaultPropsMap: 92,
  creators: 55,
  complexComponentTags: 48,
  propagationRegistered: 31,
  syntheticChildPropMerge: 9,
  popoverChildren: 2,
} as const;

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
type RegistryMap = Record<string, Record<string, string>>;
const readJson = (name: string): RegistryMap =>
  JSON.parse(fs.readFileSync(path.join(TEST_DIR, name), "utf8")) as RegistryMap;

const placeable = ComponentFactory.getRegisteredTypes();
const entries: ComponentEntryRuntime[] = placeable.map((t) =>
  resolveComponentEntryRuntime(t),
);

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

  it("childRuntime facet — syntheticPropMerge mirror == 9", () => {
    const SYNTHETIC = [
      "Breadcrumbs",
      "ComboBox",
      "GridList",
      "Select",
      "Table",
      "Tabs",
      "TagGroup",
      "Toolbar",
      "Tree",
    ];
    expect(SYNTHETIC.length).toBe(INVENTORY.syntheticChildPropMerge);
    for (const t of SYNTHETIC) {
      if (!placeable.includes(t)) continue;
      expect(
        resolveComponentEntryRuntime(t).childRuntime.syntheticPropMerge,
        `${t} syntheticPropMerge mismatch`,
      ).toBe(true);
    }
  });

  it("childRuntime facet — popoverHosted mirror == 2 (Calendar/RangeCalendar)", () => {
    expect(
      resolveComponentEntryRuntime("Calendar").childRuntime.popoverHosted,
    ).toBe(true);
    expect(
      resolveComponentEntryRuntime("RangeCalendar").childRuntime.popoverHosted,
    ).toBe(true);
    // 임의 비-popover type 은 false.
    expect(
      resolveComponentEntryRuntime("Button").childRuntime.popoverHosted,
    ).toBe(false);
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

  // ── 5. ADR-139 병행 sanity ──
  it("ADR-139 contract 와 병행 — placeable 진입점이 동일", () => {
    // Phase 7 swap 전까지 두 contract 가 같은 placeable set 을 본다는 사실 확인.
    expect(getEntryUniverseTypes()).toEqual(
      ComponentFactory.getRegisteredTypes(),
    );
  });
});
