/**
 * ADR-200 후속 — `CAPABILITY_REGISTRY` 의 `labelKey` 가 빌더 카탈로그에 실재하는지.
 *
 * capability 어휘는 `packages/shared` 가 소유하는데 문구는 빌더 카탈로그에 있다. 이
 * 경계를 잇는 것이 키 문자열뿐이라, 카탈로그 쪽에서 키를 지우거나 이름을 바꿔도
 * 타입은 아무것도 말해주지 않는다 — `t` 가 키를 그대로 돌려주므로 패널에
 * `capabilities.selectItem` 이 그대로 찍힌다. 그 조용한 새어나감을 여기서 잡는다.
 */
import { COMPONENT_INTERACTION_SPECS } from "../../../../../../../packages/shared/src/interactions/componentInteractionSpecs";
import { describe, expect, it } from "vitest";
import {
  APP_ACTIONS,
  CAPABILITY_REGISTRY,
  COMMON_CAPABILITIES,
  NEVER_OFFERED_GROUPS,
} from "@composition/shared";
import { triggerGroupLabelKey, triggerLabelKey } from "../labels";

import { localizedStrings } from "@/i18n/translations";
import type { SupportedLocale } from "@/i18n";

const LOCALES: SupportedLocale[] = ["ko-KR", "en-US"];

/** 레지스트리가 카탈로그로 내보내는 키 전부 — 출처를 함께 들고 다녀야 실패가 읽힌다 */
function collectKeys(): Array<{ where: string; key: string }> {
  const out: Array<{ where: string; key: string }> = [];

  for (const [name, def] of Object.entries(COMMON_CAPABILITIES)) {
    out.push({ where: `COMMON.${name}`, key: def.labelKey });
    if (def.param)
      out.push({ where: `COMMON.${name}.param`, key: def.param.labelKey });
  }

  for (const [type, entry] of Object.entries(CAPABILITY_REGISTRY)) {
    for (const [name, def] of Object.entries(entry.capabilities)) {
      out.push({ where: `${type}.${name}`, key: def.labelKey });
      if (def.param)
        out.push({ where: `${type}.${name}.param`, key: def.param.labelKey });
    }
  }

  for (const [name, action] of Object.entries(APP_ACTIONS)) {
    out.push({ where: `APP_ACTIONS.${name}`, key: action.labelKey });
    out.push({
      where: `APP_ACTIONS.${name}.param`,
      key: action.param.labelKey,
    });
  }

  return out;
}

describe("capability labelKey ↔ 카탈로그", () => {
  const entries = collectKeys();

  it("레지스트리가 실제로 키를 싣고 있다", () => {
    // 수집기가 빈 배열을 내면 아래 두 테스트는 조용히 통과한다 — 바닥을 박아 둔다
    // (2026-08-30 실측 40. 등재가 늘면 넘어가기만 하므로 손댈 일이 없다)
    expect(entries.length).toBeGreaterThanOrEqual(40);
  });

  it.each(LOCALES)("%s 카탈로그가 모든 키를 해소한다", (locale) => {
    const unresolved = entries.filter(({ key }) => {
      const value = localizedStrings[locale][key];
      // (ADR-287 — a label with the prop name is a formatted message: a function.)
      if (typeof value === "function")
        return String(value({ prop: "x" })).trim().length === 0;
      return typeof value !== "string" || value.trim().length === 0;
    });
    expect(
      unresolved.map((e) => `${e.where} → ${e.key}`),
      `${locale} 에서 해소되지 않는 labelKey`,
    ).toEqual([]);
  });

  it("두 locale 이 서로 다른 문구를 낸다", () => {
    // 한쪽 카탈로그에만 키를 넣으면 위 테스트는 통과하지만 언어 전환이 죽는다
    const identical = entries.filter(
      ({ key }) =>
        localizedStrings["ko-KR"][key] === localizedStrings["en-US"][key],
    );
    expect(identical.map((e) => e.key)).toEqual([]);
  });
});

/**
 * ADR-281 G1 — When 라벨은 손 목록이 아니라 등록표 그룹에서 유도한다
 * (`interactions.trigger.<개념>.<callback>` · 그룹 머리글 `interactions.triggerGroup.<개념>`).
 * 55 type 의 모든 그룹 · 보이는 이벤트 · 숨은 이벤트 (keyboard 제외 — Q3) 가 두 locale 에 있다.
 */
describe("ADR-281 — When 라벨 키 ↔ 카탈로그", () => {
  const keys: Array<{ where: string; key: string }> = [];
  for (const [type, entry] of Object.entries(CAPABILITY_REGISTRY))
    for (const group of entry.groups ?? []) {
      if (NEVER_OFFERED_GROUPS.includes(group.id)) continue;
      keys.push({
        where: `${type}.${group.id}`,
        key: triggerGroupLabelKey(group.id),
      });
      for (const event of [...group.events, ...group.hiddenEvents])
        keys.push({
          where: `${type}.${group.id}.${event}`,
          key: triggerLabelKey(group.id, event),
        });
    }

  it("등록표 58 type (55 + page 루트 · frame — ADR-281 Phase 2 · MenuItem — RAC event audit 2026-10-26) 이 그룹을 싣는다", () => {
    // (ADR-287 — types with reference API Do only join the registry too: the spec'd 58 are counted.)
    const specs = Object.keys(COMPONENT_INTERACTION_SPECS);
    expect(specs).toHaveLength(58);
    expect(specs.filter((type) => !CAPABILITY_REGISTRY[type])).toEqual([]);
    expect(keys.length).toBeGreaterThanOrEqual(55);
  });

  it.each(LOCALES)("%s 카탈로그가 모든 When 키를 해소한다", (locale) => {
    const unresolved = keys.filter(({ key }) => {
      const value = localizedStrings[locale][key];
      return typeof value !== "string" || value.trim().length === 0;
    });
    expect(unresolved.map((e) => `${e.where} → ${e.key}`)).toEqual([]);
  });

  it("keyboard 는 어느 type 의 그룹에도 패널 키가 없다 (Q3)", () => {
    for (const locale of LOCALES)
      expect(
        Object.keys(localizedStrings[locale]).filter((key) =>
          key.startsWith("interactions.trigger.keyboard."),
        ),
      ).toEqual([]);
  });
});
