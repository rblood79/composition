# ADR-157: Data-bound Collection 빌더 표시 정책 — 샘플 행 + hatch placeholder

## Status

Proposed — 2026-07-20

## Context

data-bound collection(ListBox/GridList/Table)의 **빌더(Skia) 표시 범위** 결정. 현재는 두 겹으로 표시된다:

1. **legacy 정적 cap**: 데이터가 몇천 행이어도 최대 100행(`COLLECTION_ROW_PROJECTION_WINDOW_LIMIT`, `packages/shared/src/collections/resolveCollectionItems.ts`)까지 scene 에 투영.
2. **ADR-150 A2 가상화 (Implemented)**: 높이 고정 + overflow scroll/auto 소유자는 스크롤 가시 window + overscan 6행만 투영 (`collectionVirtualization.ts`).

남은 문제: **A2 미적용 소유자(auto-height / unbounded)** 는 여전히 cap 100 전체를 투영한다. 인스턴스 50개 × 100행이면 scene/layout/command 노드 5,000+ — 편집당 비용이 노드 수에 비례하는 구조(`BuilderCanvas.projectionContentSignature` 의 stableSerialize 가 buildScene 비용의 사실상 전부)라 대규모 페이지 목표와 충돌한다.

**원칙 근거**: 빌더 = 정의·구성 도구(Pencil 동형) — 런타임 데이터 전체 재현은 빌더 목표가 아니다 (ADR-150 A1 철회 재판정, 2026-07-20 메모리 정본). 빌더의 목표는 레이아웃과 컴포넌트 배치다.

**외부 레퍼런스 실측 (Pencil 1차 소스, 2026-07-20)**: 디자인 도구는 전체 데이터를 그리는 선택지 자체가 없다.

- shadcn 샘플 `Data Table`: 데이터 영역 = 자식 0개 slot frame → **사선 hatch placeholder** + fallback 높이.
- heroui 샘플 `tableEx`: 데이터 표시 시에도 **샘플 7행만** 실노드 배치 + "1-3 of 24 rows" 라벨.

**SSOT 경계 판정 (D3)**: 본 ADR 이 도입하는 hatch placeholder 는 콘텐츠 스타일이 아니라 **빌더 저작 보조 시각**(selection/hover outline, slot marker hatch 와 동급)이다. D3 대칭("시각 결과의 동일성")은 발행 결과물의 스타일에 적용되고, 빌더 저작 오버레이는 대칭 대상이 아니다 — Preview/Publish 는 실데이터를 그대로 렌더한다. 샘플 행 자체의 스타일(catalog + Selected origin override)은 종전대로 D3 대칭 대상. (경계 판정은 2026-07-20 사용자 대화에서 확정)

**Hard Constraints**:

1. 대규모 페이지 성능: data-bound 소유자당 scene 노드 수 상한을 O(샘플 N) 으로 — 행 100 소유자 기준 노드 ~90% 감소가 측정 가능해야 함. Canvas 60fps 기준 유지.
2. **배치 진실성**: auto-height data-bound collection 의 캔버스 점유 높이 = totalRows 전체 높이 (기본 rowHeight 범위 내) — 아래 형제들의 배치가 Preview/Publish 와 일치해야 함.
3. 기존 계약 보존: rowIndex 절대 index(selection/hit-test), A2 window 소유자 동작 무변, Table header 행 항상 포함, 비-데이터 collection(totalRows 0) 무영향.
4. BC: canonical 문서/collections 데이터 재직렬화 **0건** — 표시 정책만 변경, 기존 프로젝트 데이터 무변 (사용자 영향 = 캔버스 표시 변화만).

**Soft Constraints**:

- Pencil 사용자 정신 모델과의 연속성 (hatch = "데이터/슬롯 영역, 내용은 런타임에" 라는 기존 시각 어휘 — `slotMarkerRenderer.ts` 재사용).
- ADR-146~148 로 배선된 행 템플릿(Default/Selected) 스타일 편집의 캔버스 피드백 유지.

## Alternatives Considered

### 대안 A: 현행 유지 (cap 100 + A2 window)

- 설명: 변경 없음. A2 window 미적용 소유자는 계속 100행 투영.
- 근거: A2 가 스크롤형을 이미 해소 — 추가 작업 0.
- 위험:
  - 기술: L — 변경 없음
  - 성능: **H** — auto-height/unbounded 소유자 다수 배치 시 노드 폭증 잔존. 실경로: `resolveCollectionItems.ts` cap 100 → `canvasSceneNode.ts` ListBox(~747)/GridList(~1016)/Table(~1245) 3 투영 → `BuilderCanvas.projectionContentSignature` stableSerialize 편집당 비용
  - 유지보수: L
  - 마이그레이션: L

### 대안 B: 순수 hatch (샘플 0행 — Pencil 정의 단계 방식)

- 설명: data-bound 영역을 행 없이 hatch box 만으로 표시.
- 근거: Pencil shadcn 샘플의 컴포넌트 정의 단계 방식과 동형. 노드 최소.
- 위험:
  - 기술: L — hatch box 1개 emit
  - 성능: L — 최소 노드
  - 유지보수: **H** — 행 템플릿 스타일(catalog + Selected origin, ADR-146~148 배선) 편집의 캔버스 피드백이 0 이 됨. 스타일 저작 도구에서 스타일이 안 보이는 자기모순 — Pencil 은 행 컴포넌트를 별도로 직접 보므로 이 문제가 없지만 composition 의 데이터 바인딩 흐름에서는 샘플 행이 그 역할을 담당
  - 마이그레이션: M — 기존 사용자 기대(행이 보임)의 급변
- (참고) Pencil heroui 샘플조차 사용 단계에서는 샘플 행을 실노드로 배치 — 순수 hatch 는 정의 단계 어휘.

### 대안 C: 샘플 N행 + 계산된 높이 hatch remainder (권고)

- 설명: 실데이터 앞부분 N행(기본 10)만 투영 + 나머지 영역을 `hiddenRows × rowHeight` 높이의 사선 hatch + "+N more" 라벨로 표시. A2 window 소유자는 현행 유지.
- 근거: Pencil 의 정의 단계(hatch) + 사용 단계(샘플 실노드) 두 관행의 합성. composition 은 데이터를 실제로 알므로 hatch 높이를 Pencil 의 고정 fallback 보다 정확히(totalRows 기반) 계산 가능.
- 위험:
  - 기술: M — rowHeight 추정 정밀도: per-template 커스텀 행 높이 미반영 시 hatch 높이 오차 (A2 proof 단순화 — catalog 균일 rowHeight, 2026-07-19 사용자 승인 — 와 동일 한계 공유)
  - 성능: L — 소유자당 노드 O(N)+1
  - 유지보수: M — scene hatch 높이 / layout `calculateContentHeight` 의 동일 resolver 공유 의무 (ADR-907 Layer D 계약)
  - 마이그레이션: L — 데이터 무변, 표시만 변화

### 대안 D: 샘플 N행 truncate (hatch 없음)

- 설명: N행만 투영하고 remainder 표시 없음 — 캔버스 높이도 N행만큼만.
- 근거: 구현 최소 (cap 상수만 축소).
- 위험:
  - 기술: L — 상수 변경 수준
  - 성능: L — 대안 C 와 동일
  - 유지보수: M — "데이터가 잘렸다" 는 신호 부재로 혼란 (라벨/hatch 없음)
  - 마이그레이션: **H** — auto-height 소유자의 캔버스 높이가 Preview/Publish 와 달라짐 → 아래 형제 배치가 실제와 어긋나 **배치 진실성(Hard Constraint 2) 위반** — 빌더 목표(배치) 자체 훼손

### Risk Threshold Check

| 대안 | 기술 | 성능 | 유지보수 | 마이그레이션 | HIGH+ 개수 |
| ---- | :--: | :--: | :------: | :----------: | :--------: |
| A    |  L   |  H   |    L     |      L       |     1      |
| B    |  L   |  L   |    H     |      M       |     1      |
| C    |  M   |  L   |    M     |      L       |     0      |
| D    |  L   |  L   |    M     |      H       |     1      |

루프 판정: 대안 C 가 HIGH 0 — 새 대안 추가 루프 불필요. CRITICAL 없음.

## Decision

**대안 C: 샘플 N행(기본 10) + 계산된 높이 hatch remainder** 를 선택한다.

선택 근거:

1. 유일한 HIGH-free 대안. 잔존 위험 2건(MED)은 수용 가능: rowHeight 추정 한계(기술 M)는 이미 사용자 승인된 A2 proof 단순화와 동일 한계를 공유하며 동일 후속 트랙에서 함께 정밀화한다. Layer D 동기화 의무(유지보수 M)는 ADR-907 에 확립된 계약과 테스트 패턴을 그대로 따른다.
2. 성능(Hard Constraint 1)과 배치 진실성(Hard Constraint 2)을 동시에 만족하는 유일한 구성 — 샘플이 스타일 피드백을, hatch 계산 높이가 공간 진실을 담당.
3. Pencil 사용자 정신 모델(hatch = 데이터 영역)과 연속 — 신규 학습 비용 최소.

기각 사유:

- **대안 A 기각**: 성능 H 잔존 — 대규모 페이지 목표(노드 O(N))와 정면 충돌.
- **대안 B 기각**: 행 템플릿 스타일 편집(ADR-146~148 로 방금 배선한 기능)의 캔버스 피드백을 0 으로 만드는 자기모순. Pencil 도 사용 단계에서는 샘플 행을 그린다.
- **대안 D 기각**: auto-height 소유자에서 배치 진실성 파괴 — 빌더의 존재 목적(배치 저작) 훼손. Hard Constraint 2 위반.

> 구현 상세: [157-collection-builder-display-policy-breakdown.md](design/157-collection-builder-display-policy-breakdown.md)

## Risks

| ID  | 위험                                                                                           | 심각도 | 대응                                                                                                                        |
| --- | ---------------------------------------------------------------------------------------------- | :----: | --------------------------------------------------------------------------------------------------------------------------- |
| R1  | per-template 커스텀 행 높이 미반영 → hatch 높이 오차 → auto-height 소유자 아래 형제 배치 drift |  MED   | A2 와 동일 rowHeight resolver 공유 + 기본 행높이 케이스 live 실측(Gate G1). per-template 정밀화는 A2 와 동일 후속 트랙 병합 |
| R2  | scene hatch 높이 ↔ layout `calculateContentHeight` 불일치 (Layer D 3경로 drift)                |  MED   | 동일 resolver 심볼 공유 의무 + spacing 테스트로 계약 확증 (ADR-907 패턴)                                                    |
| R3  | A2 window 소유자와 정책 충돌 (이중 적용)                                                       |  LOW   | window 해석 우선 gating 유지 — 샘플 정책은 window 미적용 소유자에만                                                         |
| R4  | Preview 와 다른 캔버스 표시에 대한 사용자 혼란                                                 |  LOW   | hatch + "+N more" 라벨 — Pencil 관행과 동형인 기존 시각 어휘(`slotMarkerRenderer`) 재사용                                   |

잔존 HIGH 위험 없음.

## Gates

잔존 HIGH 위험 없음 — 아래는 MED 위험 관리용 품질 게이트.

| Gate | 시점       | 통과 조건                                                                                                      | 실패 시 대안                              |
| ---- | ---------- | -------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| G1   | Phase 3 후 | live(visible 탭): 100+ 행 auto-height 소유자에서 샘플 10행 + hatch 표시, 아래 형제 y 가 Preview 와 일치 (±1px) | rowHeight resolver 정밀화 선행 후 재시도  |
| G2   | Phase 4 후 | spacing 테스트: scene hatch 높이와 layout 높이가 동일 resolver 산출값 (ListBox/GridList/Table 3종)             | Layer D resolver 통합 재설계              |
| G3   | Phase 5    | scene 노드 수 before/after 실측 — 행 100 소유자당 80+ 노드 감소                                                | 샘플 N 재조정 또는 hatch 병합 방식 재검토 |

## Consequences

### Positive

- 대규모 페이지에서 data-bound 소유자당 scene/layout/command 노드가 O(샘플 N)+1 로 상한 — `projectionContentSignature` 편집당 비용 직접 감소.
- 빌더 표시 철학의 일관 완성: 정의(hatch 어휘) ↔ 사용(샘플 행) — ADR-150 A1 재판정(빌더=정의·구성 도구)의 표시 축 확장.
- auto-height 소유자의 배치 진실성이 명시 계약(Hard Constraint 2 + G1)으로 승격 — 종전 cap 100 은 100행 초과 데이터에서 이미 조용히 부정확했음.

### Negative

- 캔버스에서 11행 이후 데이터를 직접 볼 수 없음 — 확인은 Preview 몫 (빌더 목표 밖으로 명시 이관).
- rowHeight 추정 한계(R1)가 hatch 높이에도 확장 적용 — per-template 정밀화 후속 부채가 A2 와 공유.
- `resolveCollectionItems` 슬라이스 소비처 3곳(ListBox/GridList/Table 투영) + layout 분기에 remainder 개념 추가 — Layer D 동기화 표면 증가.
