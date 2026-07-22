# ADR-160: collection projection 행 텍스트 측정 SSOT 단일화

## Status

Proposed — 2026-07-22

## Context

data-bound collection(ListBox / GridList)의 projection 행은 텍스트(label / description)를 **실제 자식 Text 노드가 아니라 `props`로 들고 다니고**, escape(`listBoxItem` / `gridListCard`)가 그것을 flat 하게 그린다. 이 구조 때문에 행의 크기·좌표를 레이아웃 엔진이 "자식 실측 합"으로 계산하지 못하고, **동일한 행 텍스트 높이를 세 지점이 각자 재현(reimplement)** 한다:

1. **M1 — layout 렌더 행 공식** (`utils.ts` §1.55b-2 / §1.55b2): 행 intrinsic height
2. **M2 — 가상화 stride** (`collectionVirtualization.ts`): spacer/scroll content height (단일 줄 균일 — ADR-157 표시 정책)
3. **M3 — escape paint 스택** (`skiaPrimitives.ts`): 그리기 좌표(stackY)·카드 높이·배경 밴드

이 셋 중 하나라도 서로 또는 CSS(DOM)와 어긋나면 그게 곧 Skia↔CSS parity 버그다. 2026-07-22 하루에만 동일 근원에서 **5건**이 연쇄 발생했다: width 하드코딩(`1506f237b`) / gap origin fallback 부재(`fc69a3c1e`) / 행 높이 단일 줄 공식(`bc2c0ebd2`) / 컨테이너 enrich 동결(`0821da280`) / escape 스택 겹침(`a52a91905`), 그리고 GridList 에 동형 복제(`cb04c922c`). 각각은 개별 증상을 막았을 뿐, **"세 지점이 텍스트를 각자 측정한다"는 통로 자체는 열려 있다** — 새 parity 축(RTL / letter-spacing / 새 slot)이 추가되면 다시 세 곳에 반영해야 하고, 한 곳 누락이 곧 회귀다.

이 문제는 레이아웃 엔진(composition-engine, ADR-916)이나 Skia 렌더 엔진(ADR-900)의 코어 결함이 **아니다**. 엔진은 텍스트를 측정하지 않는다 — 노드 height 는 JS 가 계산해 주입하고, 엔진은 배치만 한다. 근본 원인은 **flat-props projection 이라는 설계 선택**(대용량 collection 성능을 위해 실제 노드 unfold 를 피한 것)의 본질적 취약점이며, 텍스트 측정이 M1/M3 에 이중화되어 있다는 점이다.

**3-Domain 귀속**: 본 ADR 은 [D3(시각 스타일)](../../.claude/rules/ssot-hierarchy.md) 내부의 구현 방식 결정이다. Skia(escape) ↔ CSS(DOM) symmetric consumer 의 **시각 결과 동일성**을 측정 SSOT 단일화로 보장한다. D1(DOM 구조)·D2(props/API) 무변경.

**Hard Constraints**:

1. **성능**: 대용량 data-bound collection(수천 행)의 가상화(ADR-150 A2)를 유지한다 — flat-props 를 택한 이유. Canvas 60fps / 초기 로드 < 3초 회귀 0.
2. **BC**: 기존 projection 렌더 결과 무변경 — 측정값은 동일하고 **측정 경로만 SSOT 경유**로 바뀐다. Phase 0 baseline(라이브 실측) 대비 렌더 좌표·높이 diff 0.
3. **ADR-157 표시 정책 불변**: 가상화 stride(M2)의 단일 줄 균일은 sample/hatch 표시 정책이다. 본 ADR 의 SSOT 단일화 범위에서 **제외**한다.
4. **canonical schema 무변경**: projection 행 props 에 주입하는 것은 파생 측정값이다. IndexedDB / 저장 스키마 불변.

**Soft Constraints**:

- 반복 회귀 비용: 동일 근원 5건이 하루에 연쇄했다. 개별 패치의 인지·검증 비용이 누적된다.
- ADR-907 Layer D(container spacing resolver 3경로 공유)가 확립한 "동일 심볼 공유" 원칙을 텍스트 측정 축으로 확장하는 것이 자연스럽다.

## Alternatives Considered

### 대안 A: 완전 unfold (projection 행을 실제 Text 자식 노드로 materialize)

- 설명: window 안의 행에 대해 label/description 을 실제 Text scene 노드로 생성한다. 그러면 엔진이 자식 실측 합으로 행 높이를 계산(CSS 와 동일 메커니즘)하고, escape 는 shell(selection bg/border)만 그린다. M1/M3 측정 자체가 사라진다.
- 근거: reusable origin unfold(`_hasChildren=true`) 경로가 이미 이 방식으로 동작하며 parity 문제가 없다 — 업계 표준(DOM/CSS)이 "텍스트=실제 노드, 크기=자식 합"인 것과 정합.
- 위험:
  - 기술: **HIGH** — 가상화 window 와 재결합 필요. 행마다 Text 노드 2개(label+desc)가 scene 에 추가되어 hit-test/culling/interaction 트리 부피 증가.
  - 성능: **HIGH** — flat-props 를 택한 근본 이유(대용량 수천 행 노드 폭증)를 정면으로 역전. window 밖 행은 spacer 라 완화되나, window 내 unfold 도 노드 2배.
  - 유지보수: MEDIUM — unfold 경로는 이미 존재하나 data-bound projection 전용 재결합 로직이 신설된다.
  - 마이그레이션: **HIGH** — projection 렌더 구조 전면 교체. escape 역할 축소(shell-only)로 다수 회귀 표면.

### 대안 B: 측정 공식 단일 resolver (ADR-907 Layer D 연장, 재측정 유지)

- 설명: M1/M2/M3 이 지금도 "동일 resolver 심볼"을 공유하도록 강제(907 Layer D 확장)하되, 각 지점은 여전히 그 resolver 를 **각자 호출**한다.
- 근거: ADR-907 이 container spacing 에서 검증한 패턴. 최소 변경.
- 위험:
  - 기술: LOW — 기존 패턴 답습.
  - 성능: LOW — 측정 호출 횟수 불변.
  - 유지보수: **MEDIUM** — "각자 호출" 구조가 남아, 새 축(RTL/letter-spacing/새 slot)이 나오면 여전히 M1/M3 두 곳에 반영해야 한다. 통로가 열려 있어 회귀 재발 소지.
  - 마이그레이션: LOW — BC 유지.

### 대안 C: differential 계약 테스트만 (근본 미해결, 검출 전용)

- 설명: `layout 행 height == escape height == CSS DOM height` 3자 일치를 CI 오라클로 검증. 코드 구조는 그대로.
- 근거: ADR-156 engine-css-parity differential oracle(실 Chrome ground truth) 선례.
- 위험:
  - 기술: LOW — 테스트 하니스 추가.
  - 성능: LOW — CI 시간만.
  - 유지보수: LOW — 단, **근본(재측정 이중화)을 제거하지 않아** 발산을 사후 검출할 뿐 통로는 열려 있다.
  - 마이그레이션: LOW.

### 대안 D: 측정 SSOT 를 layout 으로 단일화 + escape 는 소비

- 설명: layout(M1)이 행 metric(rowHeight + slot 블록 높이 + 스택 offset)을 계산해 **projection 행 props 로 주입**하고, escape(M3)는 **재측정 없이** 그 값으로 그린다. 측정은 layout 한 곳에서만.
- 근거: escape 는 이미 buildSpecNodeData injection 으로 layout 이 정한 `w`/`h`를 style 로 받는다(`_slots`/`_projectedRowsContentHeight` 주입 선례 존재). 여기에 slot metric 을 추가 주입하면 배선이 성립한다. "측정 1회, 나머지는 소비"로 M1↔M3 이중화를 구조적으로 제거.
- 위험:
  - 기술: MEDIUM — layout→escape 측정 결과 주입 배선 신설(선례 경로 재사용).
  - 성능: LOW — 측정 호출이 2회(M1+M3)에서 1회(M1)로 감소.
  - 유지보수: LOW — 단일 진입점. 새 축은 layout 1곳만 반영.
  - 마이그레이션: LOW — BC 유지(측정값 동일, 경로만 SSOT 경유). `_slotMetrics` 부재 시 기존 자체 측정 fallback.

### Risk Threshold Check

| 대안 | 기술 | 성능 | 유지보수 | 마이그레이션 | HIGH+ 개수 |
| ---- | :--: | :--: | :------: | :----------: | :--------: |
| A    |  H   |  H   |    M     |      H       |     3      |
| B    |  L   |  L   |    M     |      L       |     0      |
| C    |  L   |  L   |    L     |      L       |     0      |
| D    |  M   |  L   |    L     |      L       |     0      |

**루프 판정**: A 는 HIGH 3(기술·성능·마이그레이션) — 근본이지만 대용량 성능 목표(Hard Constraint 1)와 정면 충돌하므로 채택 불가, 근본적으로 다른 접근이 필요 없다(D 가 성능 보존하며 발산 봉쇄). B/C/D 는 HIGH 0. B 는 유지보수 MEDIUM(재측정 통로 잔존)이 본 ADR 의 문제의식(통로 봉쇄)을 미해결. **D 가 근본(측정 이중화 제거) + 성능 보존(flat-props 유지)을 동시 달성**하며, C 를 안전망으로 병행하면 R1(배선 누락) 검출까지 커버된다.

## Decision

**대안 D(측정 SSOT 를 layout 으로 단일화 + escape 소비) + 대안 C(differential 계약 테스트)** 를 조합 채택한다.

- **D**: layout(`resolveListBoxItemRowHeightFromStyle` / GridList §1.55b2 공용 헬퍼)이 행 metric(rowHeight + slot 블록 높이 + 스택 offset)을 단일 산출한다. `appendListBoxRowProjection` / `appendGridListRowProjection` 이 이를 행 props `_slotMetrics` 로 주입하고, escape(`listBoxItem` / `gridListCard`)는 재측정 없이 소비한다. 측정 SSOT = layout, escape = 소비자.
- **C**: `layout 행 height == escape height == CSS DOM height` 3자 일치를 differential 계약 테스트로 CI 에 고정한다(ADR-156 선례). 가상화 stride(M2)는 검증 대상 제외(단일 줄 유지가 정상 계약).

선택 근거(위험 수용):

1. D 의 잔존 위험은 전부 MEDIUM 이하다. 최대 위험(R1 배선 stale)은 C(계약 테스트)가 CI 에서 검출하므로 수용 가능하다.
2. 성능 Hard Constraint 를 보존한다 — flat-props 를 유지하고 측정 호출을 오히려 2회→1회로 줄인다.
3. ADR-907 Layer D("동일 resolver 심볼 공유")가 확립한 원칙을 텍스트 측정 축으로 자연 확장하며, 907 의 의존 방향을 승계한다.

기각 사유:

- **대안 A 기각**: 성능(노드 폭증)·마이그레이션(flat-props 결정 역전) HIGH. 대용량 collection 성능이라는 제품 목표와 충돌한다. D 로 발산을 봉쇄하면 A 의 근본성이 불필요해진다.
- **대안 B 기각**: 재측정 이중화(M1/M3 각자 호출)를 유지해 본 ADR 의 핵심 문제(통로 봉쇄)를 미해결. 새 parity 축에서 회귀가 재발한다.
- **대안 C 단독 기각**: 발산을 사후 검출만 하고 근본(측정 이중화)을 제거하지 않는다. D 의 안전망으로 병행할 때만 가치.

> 구현 상세: [160-collection-projection-metric-ssot-breakdown.md](design/160-collection-projection-metric-ssot-breakdown.md)

## Risks

| ID  | 위험                                                                                          | 심각도 | 대응                                                                                                              |
| --- | --------------------------------------------------------------------------------------------- | :----: | ----------------------------------------------------------------------------------------------------------------- |
| R1  | layout→escape `_slotMetrics` 주입 배선 누락/stale → escape 가 옛 값으로 그림                  |  MED   | C(differential 계약 테스트)가 layout==escape 불일치를 CI 에서 검출. `_slotMetrics` 부재 시 자체 측정 fallback(BC) |
| R2  | 가상화 stride(M2, 단일 줄)와 렌더 행(M1/M3, wrap)의 이원화 유지 필요 — ADR-157 표시 정책 경계 |  MED   | stride 는 명시적으로 단일 줄 유지(157 불변), 계약 테스트는 **렌더 행만** 검증하고 stride 를 제외한다              |
| R3  | escape 가 layout 측정 결과를 받는 시점 보장 — buildSpecNodeData injection 이후 소비 순서      |  MED   | 기존 `_slots`/`_projectedRowsContentHeight` 주입 선례와 동일 경로·타이밍 재사용. Phase 2 주입 타이밍 테스트       |

잔존 HIGH 위험 없음.

## Gates

| Gate | 시점             | 통과 조건                                                                                 | 실패 시 대안                                          |
| ---- | ---------------- | ----------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| G1   | Phase 3 완료     | escape 자체 측정 호출 0건(grep) + `_slotMetrics` 소비 + 부재 시 fallback 단위 테스트 PASS | escape 재측정 잔존 시 Phase 3 미완결 — 소비 경로 보강 |
| G2   | Phase 4 완료     | differential 계약 테스트(layout==escape==CSS DOM) PASS, 가상화 stride 제외 명시           | 3자 불일치 시 M1 metric 산출 정정 후 재검             |
| G3   | Phase 5(closure) | 2026-07-22 5건 회귀 재현 안 됨 라이브(ListBox + GridList 각 1회) + BC baseline diff 0     | 회귀 재현 시 해당 Phase 롤백                          |

## Consequences

### Positive

- 반복 parity 버그의 통로 봉쇄: 텍스트 측정이 layout 1곳으로 수렴해 M1↔M3 이중화가 제거된다. 새 축(RTL/letter-spacing/새 slot)은 layout 1곳만 반영.
- 측정 호출 2회→1회 감소(성능 소폭 개선).
- ADR-907 Layer D 원칙의 텍스트 측정 축 확장으로 SSOT 체인 일관성 강화.
- differential 계약 테스트가 CI 에 남아 향후 회귀를 조기 검출.

### Negative

- layout→escape `_slotMetrics` 주입 배선이 신설된다(`canvasSceneNode.ts` projection append 2곳 + `skiaPrimitives.ts` escape 2곳 + `utils.ts` metric 반환 확장).
- 가상화 stride(M2)의 이원화(단일 줄)는 유지된다 — ADR-157 표시 정책 경계라 의도적이나, "측정이 완전히 1곳"은 아니고 "렌더 행 측정이 1곳"이다. 이 경계를 문서로 명시 유지해야 한다.
