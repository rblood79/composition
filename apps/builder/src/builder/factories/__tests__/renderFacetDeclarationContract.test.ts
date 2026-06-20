/**
 * ADR-914 Phase 3-A — Render Facet Declaration parity contract
 *
 * render facet 의 SSOT 를 `renderFacetDeclaration.ts` (declarative source) 로 역전한
 * 뒤에도, 파생 set 이 기존 `CanonicalNodeRenderer.tsx` 의 hardcoded 28종(DELEGATING_INTERNAL
 * 18 + DELEGATING_RAC 10)을 **byte-identical** 재현하는지 검증한다.
 *
 * Phase 3-A 는 deletion 0 — set membership 값을 불변 유지하며 SSOT 만 declaration 으로
 * 이전한다. 따라서:
 *   - parity A: 파생 set == CanonicalNodeRenderer export set (멤버 + insertion order).
 *   - parity B: declaration 28종이 inventory freeze 카운트(internal 18 / rac 10)와 일치.
 *   - parity C: 28종 모두 위임 사유(reason) 가 비어있지 않음 (무손실 audit — 사유 1:1 이전).
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
} from "@/preview/components/CanonicalNodeRenderer";
import {
  RENDER_FACET_DELEGATIONS,
  deriveDelegatingInternalRenderers,
  deriveDelegatingRacRenderers,
  deriveDelegatingLowerLookup,
} from "@/preview/components/renderFacetDeclaration";

// inventory freeze 정본 카운트 (914-entry-universe-inventory.md §2.3/§2.4, 2026-06-20)
const INVENTORY = { delegatingInternal: 18, delegatingRac: 10 } as const;

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

  it("parity B — declaration 카운트 == inventory freeze (internal 18 / rac 10)", () => {
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

  it("parity C — 28종 모두 위임 사유(reason) 비어있지 않음 (무손실 audit)", () => {
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
