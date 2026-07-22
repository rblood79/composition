# ADR-160: collection projection 행 텍스트 측정 SSOT 단일화

## Status

Implemented — 2026-07-22 (Phase 0~5 완결, execute-adr)

- Accepted — 2026-07-22 (리뷰 승인: reviews/160.md round 2 — round 1 이슈 3건 전부 fixed, HIGH/CRITICAL 0)
- Implemented — 2026-07-22. Phase 0(인벤토리 freeze + §2.1 실측: icon/check divergence·count-neutral) → Phase 1(SSOT `resolveCollectionRowMetric` dormant, `822359006`) → Phase 3a(escape listBoxItem/gridListCard 위임 `6b3ffd978`) → Phase 3b(M1 layout 위임 `fe43c833f`) → Phase 4(differential 계약 테스트 `a7f634520`). **설계 편차(design §2.2)**: 대안 D 의 `_slotMetrics` prop 주입 대신 escape 직접 호출(확정 `style.width` 이미 수신 → 주입 불필요, count-neutral, G1 을 더 강한 형태로 충족 — escape 의 `measureSpecWrappedTextHeight` 직접 호출 0건). 검증: 신규 13 + 회귀 700+ (specs 637 / collection builder 69) + differential 3 + type-check baseline(61) + 라이브(builder 무오류, 전 collection layout==skia). **잔존(latent, 후속)**: geometry 통로는 봉쇄됐으나 입력 산출 residual(§2.1 발견 1 icon/check maxWidth in M1 / GridList gap-source / iconSize slot override) — 현 project unfold 라 미노출, 완전 폐색은 공유 inset helper 후속.

## Context

data-bound collection(ListBox / GridList)의 projection 행은 텍스트(label / description)를 **실제 자식 Text 노드가 아니라 `props`로 들고 다니고**, escape(`listBoxItem` / `gridListCard`)가 그것을 flat 하게 그린다. 이 구조 때문에 행의 크기·좌표를 레이아웃 엔진이 "자식 실측 합"으로 계산하지 못하고, 동일한 행 텍스트 높이를 **두 개의 측정 소스**가 갈라서 산출한다:

1. **layout-util 함수** — `resolveListBoxItemRowHeightFromStyle`(`utils.ts:351`)이 **단일 정의**이며, **M1(layout 렌더 행 §1.55b-2, `utils.ts:2475`)과 M2(가상화 stride, `collectionVirtualization.ts:274`)가 이 함수를 공유**한다. M1 은 wrapContext 로 wrap 을 측정하고, M2 는 wrapContext 미전달 = 단일 줄 균일(ADR-157 표시 정책). 즉 M1/M2 는 이미 동일 함수 소스다.
2. **escape 별도 함수** — **M3(escape paint 스택, `skiaPrimitives.ts:515`)**은 `measureSpecWrappedTextHeight`(packages/specs)로 **재측정**해 그리기 좌표(stackY)·카드 높이·배경 밴드를 잡는다. escape 가 layout-util 함수를 재사용하지 못하는 이유는 **패키지 경계**(`specs ← shared ← builder`)로 apps/builder 의 측정 함수를 import 할 수 없기 때문이다.

이 두 소스(layout-util ↔ escape) 중 하나라도 서로 또는 CSS(DOM)와 어긋나면 그게 곧 Skia↔CSS parity 버그다. 2026-07-22 하루에만 동일 근원에서 **5건**이 연쇄 발생했다: width 하드코딩(`1506f237b`) / gap origin fallback 부재(`fc69a3c1e`) / 행 높이 단일 줄 공식(`bc2c0ebd2`) / 컨테이너 enrich 동결(`0821da280`) / escape 스택 겹침(`a52a91905`), 그리고 GridList 에 동형 복제(`cb04c922c`). 각각은 개별 증상을 막았을 뿐, **"escape 가 layout-util 과 별개로 텍스트를 재측정한다"는 통로 자체는 열려 있다** — 새 parity 축(RTL / letter-spacing / 새 slot)이 추가되면 layout-util 과 escape 두 소스에 반영해야 하고, 한 곳 누락이 곧 회귀다.

이 문제는 레이아웃 엔진(composition-engine, ADR-916)이나 Skia 렌더 엔진(ADR-900)의 코어 결함이 **아니다**. 엔진은 텍스트를 측정하지 않는다 — 노드 height 는 JS 가 계산해 주입하고, 엔진은 배치만 한다. 근본 원인은 **flat-props projection 이라는 설계 선택**(대용량 collection 성능을 위해 실제 노드 unfold 를 피한 것)의 본질적 취약점이며, **escape(M3)가 패키지 경계로 layout-util 측정 함수를 재사용하지 못해 별도 재측정한다는 점**이다.

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

### 대안 D: escape 재측정 제거 — layout-util 함수로 산출한 metric 을 escape 가 소비

- 설명: 측정 로직 SSOT(`resolveListBoxItemRowHeightFromStyle`)는 이미 존재하나 escape(packages/specs)가 패키지 경계로 재사용하지 못해 별도 재측정 중이다. D 는 이 재측정을 제거한다 — **`buildSpecNodeData`(layout 이후, escape 직전 — 실제 카드 폭이 `style.width` 로 확정된 시점)가 layout-util 함수로 행 metric(rowHeight + slot 블록 높이 + 스택 offset)을 산출해 escape props `_slotMetrics` 로 주입**하고, escape(M3)는 **재측정 없이** 소비한다. layout 렌더 행(M1 §1.55b-2)도 동일 `_slotMetrics` 를 소비하도록 전환해 렌더 행당 측정을 1회로 수렴한다.
- 근거: escape 는 이미 `buildSpecNodeData` injection 으로 layout 이 정한 `w`/`h`를 style 로 받는다(`buildSpecNodeData.ts:1514`, `_slots`/`_projectedRowsContentHeight` 주입 선례 존재). 여기에 slot metric 을 추가 주입하면 배선이 성립한다. **측정 주체를 `buildSpecNodeData` 로 두는 이유** = 정확한 wrap 폭(px)이 그 시점에만 확정된다(scene projection 시점엔 `style.width` 가 `%`/`calc` 라 미정). "측정 1회, 나머지는 소비"로 layout-util↔escape 이중화를 구조적으로 제거.
- 위험:
  - 기술: MEDIUM — buildSpecNodeData→escape metric 주입 배선 신설 + M1 §1.55b-2 소비 전환(선례 경로 재사용).
  - 성능: LOW — 측정 호출 수는 **count-neutral**(파이프라인 순서상 M1 은 layout 단계라 buildSpecNodeData 산출물 이전에 돌아, M1·buildSpecNodeData 가 SSOT 함수의 **공동 호출자** = 2회 유지, escape 는 재측정 0회로 감소). 실 benefit 은 호출 감소가 아니라 **SSOT 단일화 + divergence 제거**(icon/check-aware wrap 폭 불일치 포함 — design §2.1 발견 1/2).
  - 유지보수: LOW — 단일 진입점. 새 축은 buildSpecNodeData/layout-util 1곳만 반영.
  - 마이그레이션: LOW — BC 유지(측정값 동일, 경로만 SSOT 경유). `_slotMetrics` 부재 시 escape 자체 측정 fallback.

### Risk Threshold Check

| 대안 | 기술 | 성능 | 유지보수 | 마이그레이션 | HIGH+ 개수 |
| ---- | :--: | :--: | :------: | :----------: | :--------: |
| A    |  H   |  H   |    M     |      H       |     3      |
| B    |  L   |  L   |    M     |      L       |     0      |
| C    |  L   |  L   |    L     |      L       |     0      |
| D    |  M   |  L   |    L     |      L       |     0      |

**루프 판정**: A 는 HIGH 3(기술·성능·마이그레이션) — 근본이지만 대용량 성능 목표(Hard Constraint 1)와 정면 충돌하므로 채택 불가, 근본적으로 다른 접근이 필요 없다(D 가 성능 보존하며 발산 봉쇄). B/C/D 는 HIGH 0. B 는 유지보수 MEDIUM(재측정 통로 잔존)이 본 ADR 의 문제의식(통로 봉쇄)을 미해결. **D 가 근본(측정 이중화 제거) + 성능 보존(flat-props 유지)을 동시 달성**하며, C 를 안전망으로 병행하면 R1(배선 누락) 검출까지 커버된다.

## Decision

**대안 D(escape 재측정 제거 — layout-util metric 을 escape 가 소비) + 대안 C(differential 계약 테스트)** 를 조합 채택한다.

- **D**: 측정 로직 SSOT(`resolveListBoxItemRowHeightFromStyle`, `utils.ts:351`)는 이미 존재하며 M1(§1.55b-2)·M2(가상화 stride)가 공유한다. escape(M3)만 패키지 경계로 이 함수를 재사용하지 못해 `measureSpecWrappedTextHeight` 로 별도 재측정 중이다. D 는 이 재측정을 제거한다 — `buildSpecNodeData`(layout 이후, 실제 카드 폭 확정 시점)가 layout-util 함수로 행 metric(rowHeight + slot 블록 높이 + 스택 offset)을 산출해 `appendListBoxRowProjection` / `appendGridListRowProjection` 이 형성한 projection 행 props 에 `_slotMetrics` 로 주입하고, escape(`listBoxItem` / `gridListCard`)와 layout 렌더 행(M1 §1.55b-2)이 모두 이를 **소비**한다.
- **C**: `layout 행 height == escape height == CSS DOM height` 3자 일치를 differential 계약 테스트로 CI 에 고정한다(ADR-156 선례). 가상화 stride(M2)는 검증 대상 제외(단일 줄 유지가 정상 계약).

선택 근거(위험 수용):

1. D 의 잔존 위험은 전부 MEDIUM 이하다. 최대 위험(R1 배선 stale)은 C(계약 테스트)가 CI 에서 검출하므로 수용 가능하다.
2. 성능 Hard Constraint 를 보존한다 — flat-props 를 유지한다. 측정 호출 수는 count-neutral(M1 + `buildSpecNodeData` = 2 유지, escape 재측정 → 0)이며, 파이프라인 순서상 M1(layout)은 `buildSpecNodeData` 산출 이전에 돌아 두 지점이 SSOT 함수를 **공동 호출**한다(escape 만 `_slotMetrics` 소비). 개선의 본질은 호출 감소가 아니라 측정 로직 SSOT 단일화로 layout↔escape divergence(icon/check-aware 폭 불일치 포함)를 봉쇄하는 것이다 — design §2.1 실측.
3. ADR-907 Layer D("동일 resolver 심볼 공유")가 M1/M2 에서 확립한 원칙을 escape(M3)까지 확장한다 — escape 가 패키지 경계로 함수를 직접 못 쓰는 제약을 props 주입 소비로 우회. 907 의 의존 방향을 승계한다.

기각 사유:

- **대안 A 기각**: 성능(노드 폭증)·마이그레이션(flat-props 결정 역전) HIGH. 대용량 collection 성능이라는 제품 목표와 충돌한다. D 로 발산을 봉쇄하면 A 의 근본성이 불필요해진다.
- **대안 B 기각**: 재측정 이중화(M1/M3 각자 호출)를 유지해 본 ADR 의 핵심 문제(통로 봉쇄)를 미해결. 새 parity 축에서 회귀가 재발한다.
- **대안 C 단독 기각**: 발산을 사후 검출만 하고 근본(측정 이중화)을 제거하지 않는다. D 의 안전망으로 병행할 때만 가치.

> 구현 상세: [160-collection-projection-metric-ssot-breakdown.md](../design/160-collection-projection-metric-ssot-breakdown.md)

## Risks

| ID  | 위험                                                                                                 | 심각도 | 대응                                                                                                                                                                                                   |
| --- | ---------------------------------------------------------------------------------------------------- | :----: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| R1  | `buildSpecNodeData`→escape `_slotMetrics` 주입 배선 누락/stale → escape 가 옛 값으로 그림            |  MED   | C(differential 계약 테스트)가 layout==escape 불일치를 CI 에서 검출. `_slotMetrics` 부재 시 escape 자체 측정 fallback(BC)                                                                               |
| R2  | 가상화 stride(M2, 단일 줄)와 렌더 행(M1/M3, wrap)의 이원화 유지 필요 — ADR-157 표시 정책 경계        |  MED   | stride 는 명시적으로 단일 줄 유지(157 불변), 계약 테스트는 **렌더 행만** 검증하고 stride 를 제외한다                                                                                                   |
| R3  | 측정 주체를 어느 시점에 두는가 — scene projection 시점엔 `style.width` 가 `%`/`calc` 라 wrap 폭 미정 |  MED   | 측정 주체를 `buildSpecNodeData`(layout 이후, `style.width` 가 실제 px 로 확정된 시점 — `buildSpecNodeData.ts:1514`)로 확정. scene projection 이 아니라 buildSpecNodeData 가 산출·주입해 폭 정확성 보장 |

잔존 HIGH 위험 없음.

## Gates

| Gate | 시점             | 통과 조건                                                                                                                                                                                                        | 실패 시 대안                                                        |
| ---- | ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| G1   | Phase 3 완료     | escape 가 `_slotMetrics` 존재 시 자체 측정 skip (`measureSpecWrappedTextHeight` 호출이 **fallback 분기에만** 잔존 — grep 으로 소비 분기와 fallback 분기 확인) + `_slotMetrics` 부재 시 fallback 단위 테스트 PASS | escape 가 소비 분기에서도 재측정 시 Phase 3 미완결 — 소비 경로 보강 |
| G2   | Phase 4 완료     | differential 계약 테스트(layout==escape==CSS DOM) PASS, 가상화 stride 제외 명시                                                                                                                                  | 3자 불일치 시 M1 metric 산출 정정 후 재검                           |
| G3   | Phase 5(closure) | 2026-07-22 5건 회귀 재현 안 됨 라이브(ListBox + GridList 각 1회) + BC baseline diff 0                                                                                                                            | 회귀 재현 시 해당 Phase 롤백                                        |

## Consequences

### Positive

- 반복 parity 버그의 통로 봉쇄: 텍스트 측정이 `buildSpecNodeData` 산출 1곳으로 수렴해 layout-util↔escape 이중화가 제거된다(escape 는 소비만). 새 축(RTL/letter-spacing/새 slot)은 layout-util 함수 1곳만 반영.
- layout↔escape 측정 divergence 제거(icon/check-aware wrap 폭 불일치 포함, design §2.1 발견 1). 측정 호출 수는 count-neutral(M1 + `buildSpecNodeData` = 2; escape 재측정 → 0) — M1·buildSpecNodeData 는 SSOT 함수 공동 호출자, escape 만 `_slotMetrics` 소비.
- ADR-907 Layer D 원칙(M1/M2 공유)을 escape(M3)까지 확장해 SSOT 체인 일관성 강화.
- differential 계약 테스트가 CI 에 남아 향후 회귀를 조기 검출.

### Negative

- `buildSpecNodeData`→escape `_slotMetrics` 주입 배선이 신설된다(`buildSpecNodeData.ts` metric 산출·주입 + `skiaPrimitives.ts` escape 2곳 소비 전환 + `utils.ts` metric 반환 확장 + `utils.ts` §1.55b-2 소비 전환).
- 가상화 stride(M2)의 이원화(단일 줄)는 유지된다 — ADR-157 표시 정책 경계라 의도적이나, "측정이 완전히 1곳"은 아니고 "렌더 행 측정이 1곳"이다. 이 경계를 문서로 명시 유지해야 한다.
