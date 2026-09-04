/**
 * ADR-914 Phase 3-A — Render Facet Declaration parity contract
 *
 * render facet 의 SSOT 를 `renderFacetDeclaration.ts` (declarative source) 로 역전한
 * 뒤에도, 파생 set 이 `CanonicalNodeRenderer.tsx` 의 DELEGATING_INTERNAL/DELEGATING_RAC export
 * 와 **byte-identical** 한지 검증한다 (현 30종 = DELEGATING_INTERNAL 18 + DELEGATING_RAC 12).
 *
 * Phase 3-A 원형은 deletion 0 — set membership 값을 불변 유지하며 SSOT 만 declaration 으로
 * 이전했다(rac 10 freeze). 2026-06-22 ToggleButtonGroup/ToggleButton 2종이 delegating-rac 에
 * 추가됨(cutover 누락 toggle 미동작 버그 정정, rac 10→12). parity 는 declaration↔export 동등성을
 * 검증하므로 멤버 추가 후에도 유효 — INVENTORY 카운트만 동반 갱신. 검증 항목:
 *   - parity A: 파생 set == CanonicalNodeRenderer export set (멤버 + insertion order).
 *   - parity B: declaration 전수가 inventory 카운트(INVENTORY 상수)와 일치.
 *   - parity C: 30종 모두 위임 사유(reason) 가 비어있지 않음 (무손실 audit — 사유 1:1 이전).
 *   - parity D: key 중복 없음 (internal/rac 각 namespace 내).
 *
 * kill criteria: parity A 불일치 시 declaration 파생 전환 중단 (set 값이 바뀌면 hot-path
 * 위임 분기가 깨져 live 렌더 회귀).
 *
 * 실행: pnpm -F @composition/builder exec vitest run src/builder/factories/__tests__/renderFacetDeclarationContract.test.ts
 */

import { describe, it, expect } from "vitest";

import {
  DELEGATING_INTERNAL_RENDERERS,
  DELEGATING_RAC_RENDERERS,
} from "@/preview/components/canonicalRendererRegistry";
import {
  RENDER_FACET_DELEGATIONS,
  deriveDelegatingInternalRenderers,
  deriveDelegatingRacRenderers,
  deriveDelegatingLowerLookup,
} from "@/preview/components/renderFacetDeclaration";

// inventory freeze 정본 카운트 (914-entry-universe-inventory.md §2.3/§2.4, 2026-06-20)
// rac 10 → 12 (2026-06-22): ToggleButtonGroup/ToggleButton 추가. ADR-912 cutover 시점부터
//   delegating-rac 에 누락돼 있던 것을 ADR-914 §2.4 가 그대로 freeze 했으나(SSOT 역전 무손실,
//   당위 분류 아님), generic rac 경로가 selectedKeys/onSelectionChange/id 를 미emit 하여
//   CSS preview 에서 toggle 미동작하던 버그를 정정 — CheckboxGroup/RadioGroup 동형 위임 등록.
// internal 18 → 23 (2026-06-24): Card 패밀리 5(card/cardpreview/cardheader/cardcontent/cardfooter)
//   추가. ADR-912 Card cutover 시점부터 DELEGATING_INTERNAL 에 누락돼 있던 것을, Preview canonical
//   경로에서 self-compose 자식 슬롯(CardPreview/Image/Header/Content/Footer)이 누락되어 Skia↔Preview
//   비대칭이던 버그 정정으로 등록. disclosuregroup/nav 동형(childrenByParent 보강 필요).
// internal 23 → 24 (2026-06-25): tableview 추가. TableView binding.source.renderer 가 "div" 라
//   DELEGATING_INTERNAL 매칭(source.renderer 기준)을 못 타 자식(Header/Body/Column/Row/Cell)이
//   Preview 에 통째로 미렌더(Skia 는 자식 generic box 렌더 → 비대칭). renderer "div"→"tableview" +
//   delegating 등록으로 renderTableView 위임 + flattenNodeChildrenByParent 보강 활성화.
// internal 24 → 25 (2026-06-27): buttongroup 추가. ButtonGroup binding.source.renderer 가 "div" 라
//   DELEGATING_INTERNAL 매칭을 못 타 자식 Button×2(factory 자동 생성)가 Preview 에 통째로 미렌더
//   (Skia 는 자식 직접 렌더 → 비대칭, "Preview 렌더링 안 됨"). renderer "div"→"buttongroup" +
//   delegating 등록으로 renderButtonGroup 위임 + flattenNodeChildrenByParent 보강 활성화. tableview 동형.
// internal 25 → 28 (2026-06-27): avatargroup/cardview/pagination 추가. ButtonGroup fix 후 grep 전수
//   감사로 동일 누락 3건 적발 — factory 가 자식(Avatar×3 / Card×3 / Button×5)을 생성하고 render{Type}
//   가 childrenByParent 로 그 자식을 렌더하는 self-compose 인데 binding renderer="div" + 미등록 →
//   generic fall-through 로 자식 통째 미렌더(Skia 비대칭). renderer "div"→고유 id + delegating 등록.
// internal 28 → 29 (2026-06-27): toast 추가. 21후보 정밀 감사로 ButtonGroup 동형 잔여 1건 적발 —
//   renderToast 가 자식 Heading/Description(factory 생성)을 childrenByParent self-compose, renderer="div"
//   + 미등록 → fall-through. palette 미노출 imperative 알림이나 imperative/AI/import 생성 대비 선제 등록.
// internal 29 → 31 (2026-07-02): calendar/rangecalendar 추가 (B2 Style 패널 동기화). 미등록 시
//   INTERNAL_RENDERERS[calendar]=Calendar 직접 컴포넌트 경로라 renderCalendar 미사용 → CalendarHeader
//   자식 style 의 headerStyle 전달이 안 돼 Style 패널 Layout 편집이 DOM `<header>` 에 미반영(Skia
//   inline_icon_text 만 반영 → CSS↔Skia 비대칭). delegating 전환으로 renderCalendar 위임 + 자식
//   CalendarHeader/CalendarGrid 는 Calendar self-compose 라 재귀 skip.
// rac 12 → 13 (2026-08-21): TextArea 추가. generic rac 경로는 RAC TextField 를 그리고 그 안에
//   factory 가 만든 canonical `Input` 자식이 들어가 DOM 이 **한 줄 `<input>`** 이었다 — 이름이
//   TextArea 인데 여러 줄이 아니었고 `rows` 도 시각에 반영되지 않았다. RAC 에는 TextArea
//   **컨테이너** primitive 가 없고 `<TextField>` 안에 `<TextArea>` control 을 넣는 것이 D1
//   계약이라, TextField 선례대로 wrapper self-compose 위임으로 등록.
const INVENTORY = { delegatingInternal: 31, delegatingRac: 13 } as const;

describe("ADR-914 Phase 3-A — render facet declaration parity", () => {
  it("parity A — 파생 internal set == CanonicalNodeRenderer DELEGATING_INTERNAL (멤버 + 순서)", () => {
    const derived = [...deriveDelegatingInternalRenderers()];
    const actual = [...DELEGATING_INTERNAL_RENDERERS];
    // insertion order 까지 동일해야 byte-identical (Set spread 는 insertion order).
    expect(derived).toEqual(actual);
  });

  it("parity A — 파생 rac set == CanonicalNodeRenderer DELEGATING_RAC (멤버 + 순서)", () => {
    const derived = [...deriveDelegatingRacRenderers()];
    const actual = [...DELEGATING_RAC_RENDERERS];
    expect(derived).toEqual(actual);
  });

  it("parity A strict — 양 set 의 집합 동등성 (extra/missing 0)", () => {
    const derivedInternal = deriveDelegatingInternalRenderers();
    const derivedRac = deriveDelegatingRacRenderers();
    for (const k of DELEGATING_INTERNAL_RENDERERS) {
      expect(derivedInternal.has(k), `internal missing: ${k}`).toBe(true);
    }
    for (const k of derivedInternal) {
      expect(DELEGATING_INTERNAL_RENDERERS.has(k), `internal extra: ${k}`).toBe(
        true,
      );
    }
    for (const k of DELEGATING_RAC_RENDERERS) {
      expect(derivedRac.has(k), `rac missing: ${k}`).toBe(true);
    }
    for (const k of derivedRac) {
      expect(DELEGATING_RAC_RENDERERS.has(k), `rac extra: ${k}`).toBe(true);
    }
  });

  it("parity B — declaration 카운트 == inventory (INVENTORY 상수 기준)", () => {
    const internal = RENDER_FACET_DELEGATIONS.filter(
      (d) => d.kind === "delegating-internal",
    );
    const rac = RENDER_FACET_DELEGATIONS.filter(
      (d) => d.kind === "delegating-rac",
    );
    expect(internal.length).toBe(INVENTORY.delegatingInternal);
    expect(rac.length).toBe(INVENTORY.delegatingRac);
    expect(RENDER_FACET_DELEGATIONS.length).toBe(
      INVENTORY.delegatingInternal + INVENTORY.delegatingRac,
    );
  });

  it("parity C — 30종 모두 위임 사유(reason) 비어있지 않음 (무손실 audit)", () => {
    const empty = RENDER_FACET_DELEGATIONS.filter(
      (d) => !d.reason || d.reason.trim().length === 0,
    ).map((d) => `${d.kind}:${d.key}`);
    expect(empty, `사유 누락: ${empty.join(", ")}`).toEqual([]);
  });

  it("parity D — key 중복 없음 (namespace 별)", () => {
    const internalKeys = RENDER_FACET_DELEGATIONS.filter(
      (d) => d.kind === "delegating-internal",
    ).map((d) => d.key);
    const racKeys = RENDER_FACET_DELEGATIONS.filter(
      (d) => d.kind === "delegating-rac",
    ).map((d) => d.key);
    expect(new Set(internalKeys).size).toBe(internalKeys.length);
    expect(new Set(racKeys).size).toBe(racKeys.length);
  });

  it("lowercase lookup — internal/rac 모두 lowercase 정규화 (entryUniverse resolveRenderMode 계약)", () => {
    const { internal, rac } = deriveDelegatingLowerLookup();
    // internal key 는 이미 lowercase → 그대로.
    expect(internal.has("progressbar")).toBe(true);
    expect(internal.has("disclosuregroup")).toBe(true);
    // rac key 는 PascalCase → lowercase 정규화 후 매칭.
    expect(rac.has("slider")).toBe(true);
    expect(rac.has("checkboxgroup")).toBe(true);
    expect(rac.has("Slider")).toBe(false); // 원형은 미포함(정규화 확인)
    expect(internal.size).toBe(INVENTORY.delegatingInternal);
    expect(rac.size).toBe(INVENTORY.delegatingRac);
  });
});
