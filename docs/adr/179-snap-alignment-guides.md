# ADR-179: 캔버스 스냅·정렬 가이드 — 페이지 축 우선, absolute 요소 확장

## Status

Proposed — 2026-08-12

## Context

2026-08-12 이동 기능 gap 실측 — 캔버스의 정렬 보조는 **snap-to-grid 하나뿐**이다:

- 유일한 스냅: `usePageDrag.ts:146-150` 의 그리드 반올림 (8/16/24px, 기본 OFF — `stores/canvasSettings.ts:128`). 객체 기준 스냅(다른 페이지/요소의 가장자리·중앙)·정렬선(스마트 가이드)·등간격 표시는 리포지토리 전체 grep 0건.
- absolute 요소 자유 이동 (`useDragBridge.ts:169-227`) 에는 스냅이 아예 없다.
- 기존 감사 문서 (`docs/reference/audits/2026-07-16-figma-benchmark-gap-analysis.md` H1, 우선순위 4순위) 가 같은 결론 — 본 ADR 은 그 축의 착수 결정이다.

Figma/Pencil 에서 겹치지 않게 페이지를 배치하고 요소를 정돈하는 작업은 스냅·정렬선에 의존한다. 특히 페이지가 자유 배치 모델이 된 지금 (2026-08-11 활성 페이지 최상단 + occlusion 작업으로 겹침 UX 가 정리됨), 페이지를 나란히 놓는 조작이 눈대중뿐이다.

**3-domain**: builder-system 오버레이/인터랙션 — D1/D2/D3 무관 (publish 출력 무관, 스키마 무변경).

### Hard Constraints

1. **ADR-176 계약 보존** — 스냅은 transient presentation publish **직전의 순수 좌표 보정**으로 얹는다. 프레임당 publish 1회·map clone 금지·finish-only canonical commit 경로 무변경.
2. 60fps — 스냅 후보 계산은 프레임당 O(가시 페이지 수) 상한 (페이지 수십 규모 전수로 충분). absolute 요소 확장 시 후보 수집은 기존 SpatialIndex 재사용.
3. 임계값은 screen px 기준 (scene 임계 = threshold / zoom) — zoom 무관하게 화면상 동일 흡착 거리.
4. 우선순위 규칙 고정 — 객체 스냅 > snap-to-grid, Cmd/Ctrl 홀드 시 전 스냅 억제 (Figma 관례).
5. 정렬선은 드래그 중 순간 피드백(조작 표식) — 2026-08-12 페이지 간 occlusion 규칙(§8.5)의 콘텐츠성 chrome 분류에 넣지 않는다 (드래그 대상 = 활성 = 최상단이라 실질 겹침 없음, 판정 기록은 breakdown §3.3).

### Soft Constraints

- 스냅 판정은 훅 밖 순수 함수 (기존 `resolveSelectionDragIntent` 류 단일 진입점 패턴).
- 정렬선 색은 builder 시맨틱 토큰 (css-tokens.md — builder accent 는 무채색, 명도 대비로).

## Alternatives Considered

### 대안 A: 페이지 축 우선 착수 → absolute 요소 확장 (단계형, 같은 스냅 엔진)

- Phase 1~2 에서 페이지 드래그 6축 스냅 + 정렬선, Phase 3 에서 absolute 요소로 후보 수집만 교체 확장, 등간격은 후속 phase.
- 위험: 기술(M — 신규 서브시스템이지만 순수 함수 + 오버레이 렌더로 국소) / 성능(L~M — 페이지 수 전수, 확장 시 SpatialIndex) / 유지보수(M) / 마이그레이션(L — 스키마 무변경)

### 대안 B: 범용 스냅 엔진 일괄 (페이지+요소+수동 가이드+ruler+등간격 동시)

- 위험: 기술(H — 표면 5개 동시) / 성능(M) / **유지보수(H — scope 과대: sub-group 다분할과 부분 미완 잔류 위험, adr-writing.md M4 패턴)** / 마이그레이션(L)

### 대안 C: snap-to-grid 강화만 (기본 ON + 세분 격자)

- 위험: 기술(L) / 성능(L) / 유지보수(L) / 마이그레이션(L) — 단 **기능 미달: 객체 정렬(페이지끼리 나란히)은 격자로 해결되지 않음 (페이지 폭이 격자 배수라는 보장이 없다)**

### Risk Threshold Check

| 대안 | HIGH+ 요약                       | 판정            |
| ---- | -------------------------------- | --------------- |
| A    | 없음 (전 축 L/M)                 | **통과 — 채택** |
| B    | 기술 H + 유지보수 H (scope 과대) | 실패            |
| C    | 기능 미달                        | 실패            |

## Decision

**대안 A 채택 — 같은 스냅 엔진을 페이지 축부터 단계 적용한다.**

1. `resolveSnappedPosition(raw, movingBounds, candidates, threshold)` 순수 함수가 축별 독립(6축: left/centerX/right × top/centerY/bottom) 최근접 스냅과 정렬선 목록을 반환한다.
2. 페이지 드래그 경로에 publish 직전 보정으로 배선하고, 정렬선은 오버레이 패스에서 렌더한다.
3. 우선순위: 객체 > 그리드, Cmd/Ctrl 억제, (ADR-178 도입 시) Shift 축 고정 먼저 → 고정 축만 스냅.
4. absolute 요소 확장은 후보 수집만 SpatialIndex 로 교체 — 판정 함수·오버레이는 공유.

기각 사유 — B: 표면 5개 동시 착수는 sub-group 다분할·부분 미완 잔류의 전형 (M4 선차단). C: 객체 정렬 요구를 격자가 대체하지 못한다.

> 구현 상세: [179-snap-alignment-guides-breakdown.md](design/179-snap-alignment-guides-breakdown.md)

## Risks

| ID  | 위험                                                                                                                                                                                  | 심각도 | 대응                                                                                                   |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----: | ------------------------------------------------------------------------------------------------------ |
| R1  | 드래그 프레임 경로에 후보 계산 추가 — ADR-176 이 정리한 프레임 예산을 재오염 (`usePageDrag.calculatePosition` → `pagePositionPresentation` publish → `skiaOverlayBuilder` 렌더 3지점) |  HIGH  | 후보는 드래그 **시작 시 1회 수집** + 프레임당 판정만 O(후보) / G2 프레임 비용 실측 (페이지 10/50 tier) |
| R2  | 흡착 UX 실패 — 임계값·해제 히스테리시스가 어긋나면 "달라붙어 못 떼는" 조작감                                                                                                          |  MED   | screen px 임계 + Cmd 억제 + Figma 임계 관례 실측 후 lock (Phase 0), live 조작감 확인을 G1 에 포함      |
| R3  | snap-to-grid·Shift 축 고정과의 규칙 충돌                                                                                                                                              |  LOW   | 우선순위 표를 breakdown §3.2 로 고정 + 유닛 테스트                                                     |
| R4  | 정렬선 chrome 분류 오판 — occlusion/클립 규칙(§8.5)과 불일치                                                                                                                          |  LOW   | 조작 표식 분류 판정을 breakdown §3.3 에 기록, 겹침 케이스 live 확인                                    |

## Gates

| Gate | 통과 조건                                                                                                                         |
| ---- | --------------------------------------------------------------------------------------------------------------------------------- |
| G1   | live: 페이지 드래그 시 인접 페이지 가장자리·중앙에 흡착 + 정렬선 표시/해제, Cmd 홀드 시 억제, snap-to-grid 동시 활성 시 객체 우선 |
| G2   | 드래그 프레임 비용 — 후보 수집 드래그당 1회, 프레임당 판정 O(후보), 페이지 10/50 tier 에서 프레임 예산 회귀 0 (ADR-176 G2 동형)   |
| G3   | absolute 요소 확장: 형제/컨테이너 기준 흡착 live + SpatialIndex 재사용 확인                                                       |
| G4   | 스냅 순수 함수 유닛 (축별/임계/우선순위/히스테리시스) + type-check + `docs/CHANGELOG.md` 갱신 (Implemented 승격 시)               |

## Consequences

### Positive

- 페이지·absolute 요소 배치가 눈대중에서 흡착 기반 정밀 조작으로 — 감사 문서 H1 축의 첫 착수.
- 순수 함수 스냅 엔진이라 ADR-178 다중 드래그(리더 bbox 기준)에도 그대로 승계 가능.

### Negative

- 드래그 프레임 경로에 계산이 추가된다 (R1 상한 관리 필요).
- 스냅 설정(객체/그리드/억제)의 사용자 표면이 늘어난다 — SettingsPanel 항목 추가.
