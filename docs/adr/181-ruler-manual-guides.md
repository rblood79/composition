# ADR-181: 눈금자(Ruler) + 수동 가이드 — 뷰포트 chrome 과 페이지 귀속 가이드 라인

## Status

Accepted — 2026-08-13 (리뷰 round 1 승인 — 이슈 0건, `docs/adr/reviews/181.md`)

## Context

캔버스 정렬 보조는 [ADR-179](completed/179-snap-alignment-guides.md) (Implemented 2026-08-12) 로 **객체 스냅** (드래그 순간의 정렬선·등간격) 까지 도달했지만, 사용자가 **미리 놓아두는 고정 기준선** 이 없다 — Figma/Pen 의 ruler + 수동 가이드에 해당하는 표면이 0 이다 (2026-08-13 실측: `ruler`/`guide` 렌더·문서 필드 grep 0건, `snapGuides.ts` 후보는 rect 전용).

두 산출물은 성격이 갈린다:

- **Ruler (눈금자)**: 순수 뷰포트 chrome — 문서 데이터 없음, `panOffset`/`zoom` 의 함수. 토글 상태만 빌더 UI 설정.
- **수동 가이드**: 페이지(아트보드) 귀속 **문서 데이터** — 저장·복원되고 undo 대상이어야 한다. [ADR-177](completed/177-page-position-document-data.md) 이 페이지 위치로 확립한 5계층 (document 필드 / persist·hydrate / 히스토리 canonical entry / 소비 UI / 검증) 과 동형 문제다.

**3-domain**: D1/D2/D3 무관 — builder-system 축 (catalog/spec/Generator 무접촉). 가이드는 canonical authoring 데이터지만 Preview/Publish 산출물에 영향 없음 (Figma 와 동일 — 문서 데이터지만 배포 무관, ADR-177 과 같은 분류).

### Hard Constraints

1. **성능 무영향 (사용자 요구 2026-08-13)** — 60fps 계약 유지. 정량 기준: (a) ruler·가이드 렌더는 오버레이 패스 증가분이 프레임 예산(16.7ms) **1% 이하** (ADR-179 G2 어법 — 정렬선 판정 0.011% 실측 전례), (b) 스냅 후보 확장은 **드래그당 1회 수집** 상한 유지 (ADR-179 R1 계약 승계), (c) 가이드 드래그 중 canonical write·히스토리·persist **각 0** — finish 1회 (ADR-176/177 계약 승계), (d) layoutVersion·레이아웃 엔진 경로 무접촉, (e) per-frame 신규 할당 최소화 (paint 풀 재사용).
2. **BC 0%** — canonical additive 필드 + 필드 부재 문서 폴백 (가이드 없음 = 현행 동일), lazy write, 로드 시 재직렬화 0 (ADR-177 HC3 동형).
3. **undo 일원화** — 기존 히스토리 파이프라인 편입 (per-page 50 depth, jump-to-index). 별도 undo 스택 금지 (ADR-177 HC4 동형).
4. **ADR-179 스냅 계약 보존** — `SNAP_THRESHOLD_SCREEN_PX` 단일 임계, 축별 독립 최근접, 기존 rect 후보 판정 무변경 (기존 유닛 GREEN 유지).
5. **기존 pointer 체인 회귀 0** — ruler OFF + 가이드 0 상태에서 선택/드래그/더블클릭/페이지 타이틀 경로 무변경.

### Soft Constraints

- ADR-176 (transient presentation) / ADR-177 (5계층) / ADR-179 (순수 함수 스냅) 패턴 재사용 — 신규 package/의존성 없음.
- 외부 관례 정합: Figma (rulers Shift+R 토글, ruler 드래그로 가이드 생성, frame 귀속 가이드는 frame 과 함께 이동).

## Alternatives Considered

### 대안 A: ruler = 뷰포트 chrome + 가이드 = 페이지 귀속 canonical 필드 (ADR-177 동형 5계층)

- 설명: ruler 는 오버레이 패스 렌더 전용 (토글만 설정). 가이드는 `pageGuides` additive root 필드 (페이지-로컬 px) + `page-guide` 히스토리 entry + `resolveSnappedPosition` 라인 입력 확장 + `withPageOcclusionClip` 경유 상시 렌더.
- 근거: Figma 가 동일 구조 — 가이드는 frame(페이지) 귀속 문서 데이터로 frame 과 함께 이동하고 undo 대상. composition 은 페이지가 이동 가능(ADR-177)하므로 페이지 귀속이어야 가이드가 페이지를 추종한다.
- 위험:
  - 기술: M — 히스토리 비-element kind 3번째 (전례 2종으로 패턴 확립 — `history.ts:437`)
  - 성능: L — 오버레이 패스 O(가시 틱 + 활성 가이드), 프레임 경로 무변경 (HC1 게이트로 확증)
  - 유지보수: M — pointer 체인에 히트 분기 1종 추가 (단일 판정 함수로 격리)
  - 마이그레이션: L — additive + 폴백, BC 0%

### 대안 B: 에디터 사이드카 저장 (문서 스키마 무침범) + undo 제외

- 설명: 가이드를 IndexedDB 별도 store 에 저장, 히스토리 미편입.
- 근거: ADR-177 대안 B 와 동형 — 스키마 침범 회피가 유일 장점.
- 위험:
  - 기술: L
  - 성능: L
  - 유지보수: **H** — undo 불일치 (가이드 조작만 Cmd+Z 제외 — 사용자 모델 파괴, ADR-177 이 기각한 동일 사유) + 문서 이동성 소실 (다른 기기/공유 시 가이드 소실)
  - 마이그레이션: L

### 대안 C: 캔버스 전역(scene) 가이드 — 페이지 무귀속

- 설명: 가이드를 페이지가 아닌 scene 전역 좌표의 무한 라인으로 저장.
- 근거: 일부 데스크톱 도구(Photoshop 단일 캔버스) 관례.
- 위험:
  - 기술: L
  - 성능: L
  - 유지보수: **H** — 페이지 이동(ADR-177 로 일상 조작) 시 가이드가 따라가지 않아 정렬 기준 상실. 다중 페이지 캔버스에서 어느 페이지의 기준선인지 불명. Figma 도 frame 귀속으로 이 문제를 회피.
  - 마이그레이션: L

### Risk Threshold Check

| 대안 | 기술 | 성능 | 유지보수 | 마이그레이션 | HIGH+ 개수 |
| ---- | ---- | ---- | -------- | ------------ | :--------: |
| A    | M    | L    | M        | L            |     0      |
| B    | L    | L    | **H**    | L            |     1      |
| C    | L    | L    | **H**    | L            |     1      |

루프 판정: 대안 A 가 HIGH 0 으로 통과 — 추가 대안 불요.

## Decision

**대안 A 채택 — ruler 는 뷰포트 chrome, 가이드는 페이지 귀속 문서 데이터.**

1. Ruler: `rulerRenderer` 신규 + 오버레이 패스 배선. 문서 데이터 없음 — 토글은 `canvasSettings` slice 필드 + **설정 패널 on/off 스위치 노출** (기존 Grid/스냅 설정과 같은 곳 — 사용자 지정 2026-08-13) + 보조 단축키 Shift+R. 별도 버전 카운터 없음 (뷰포트 변경이 이미 프레임을 굴림).
2. 가이드: `pageGuides` canonical additive root 필드 (페이지-로컬 px — 페이지 이동 자동 추종) + `page-guide` 히스토리 entry (ADR-177 early-branch 패턴) + finish-only commit.
3. 스냅: `resolveSnappedPosition` 에 축별 라인 입력 추가 — **정렬선 판정에만** 참여 (등간격 이웃 아님), 소비처 2곳이 드래그 세션 시작 시 1회 주입.
4. 렌더: 상시 표시 콘텐츠성 chrome — 페이지 rect 클립 + `withPageOcclusionClip` 경유 (canvas-rendering.md §8.5. 스냅 정렬선의 "조작 표식 미적용" 판정과 다름).
5. 인터랙션: ruler 드래그 생성 / 가이드 이동 / ruler 복귀 삭제 — 히트 판정은 순수 함수 단일 진입점, 미스 시 기존 pointer 체인 무변경 통과.

선택 근거 (위험 수용): 잔존 위험이 전 축 M 이하이고, M 2건 (히스토리 kind 확장 / pointer 체인 분기) 은 각각 ADR-177 확립 패턴과 단일 판정 함수 격리로 상쇄 — HC1 성능 계약은 전용 Gate 로 확증한다.

기각 사유 — **B**: undo 불일치가 사용자 모델(Cmd+Z 일원)을 깨고 문서 이동성을 잃는다 (ADR-177 대안 B 기각과 동일 논거). **C**: 페이지 이동이 일상 조작인 캔버스에서 가이드가 페이지를 추종하지 못하면 기준선 기능 자체가 무너진다.

> 구현 상세: [181-ruler-manual-guides-breakdown.md](design/181-ruler-manual-guides-breakdown.md)

## Risks

| ID  | 위험                                                                                                                                                                                                                                  | 심각도 | 대응                                                                                                                                       |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----: | ------------------------------------------------------------------------------------------------------------------------------------------ |
| R1  | pointer 체인 경합 — 가이드 히트 분기가 기존 캡처 체인 (`BuilderCanvas.tsx:1013` onPointerDownCapture / `resolveSelectionDragIntent` / 페이지 타이틀 paint-rank guard / `usePageDrag.ts` / `useDragBridge.ts`) 의 선택·드래그를 오탈취 |  HIGH  | 히트 판정 순수 함수 단일 진입점 (±4 screen px 임계 한정, 미스 시 기존 체인 무변경 통과) + 기존 인터랙션 유닛 전수 GREEN (G2) + live 스모크 |
| R2  | 스냅 계약 오염 — rect 전제 (`snapGuides.ts:85` rectLines) 에 라인 입력 추가 시 등간격(spacing) 판정 오염 또는 기존 rect 판정 회귀                                                                                                     |  MED   | 라인은 정렬선 판정에만 참여 (별도 파라미터 — `projectCandidate` 미통과) + 기존 유닛 GREEN + spacing 미오염 유닛 (G3)                       |
| R3  | 히스토리 비-element kind 3번째 — 소비 분기 누락 시 undo 에서 무시/크래시                                                                                                                                                              |  MED   | ADR-177 확립 패턴 (early-branch + 정적 가드) 재적용 + Phase 0 소비 분기 전수 grep                                                          |
| R4  | occlusion/클립 누락 — 겹친 페이지에서 아래 페이지 가이드가 위 페이지 body 위에 표시                                                                                                                                                   |  MED   | `withPageOcclusionClip` (`skiaOverlayBuilder.ts:264`) 경유 + 페이지 rect 클립 (G4)                                                         |
| R5  | 성능 회귀 — ruler 틱 렌더·가이드 hover 판정·스냅 후보 확장의 프레임 비용 누적                                                                                                                                                         |  MED   | HC1 정량 기준 전용 Gate (G5) — 오버레이 증가분 1% 이하 측정 + 드래그 중 write 0 재현 + per-frame 할당 검토                                 |
| R6  | BC — 구 빌드가 `pageGuides` 보유 문서를 거부                                                                                                                                                                                          |  LOW   | additive + 폴백 (ADR-177 R2 에서 파서 additive 안전 확정 — 승계), lazy write 재직렬화 0                                                    |

## Gates

| Gate | 시점         | 통과 조건                                                                                                                         | 실패 시 대안                                            |
| ---- | ------------ | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| G1   | Phase 7      | live: 토글 → ruler 드래그 생성 → 이동 → ruler 복귀 삭제 → 각 조작 undo/redo 왕복 → 새로고침 유지                                  | 해당 Phase 재작업                                       |
| G2   | Phase 5 직후 | ruler OFF + 가이드 0 에서 기존 선택/드래그/더블클릭/타이틀 유닛 전수 GREEN + live 무변경                                          | 히트 분기 우선순위 재설계 (기존 체인 진입 전 판정 격리) |
| G3   | Phase 6 직후 | 가이드 흡착 live + 기존 rect 스냅 유닛 GREEN + spacing 미오염 유닛                                                                | 라인 입력을 별도 판정 pass 로 분리                      |
| G4   | Phase 4 직후 | 겹친 페이지 occlusion + 페이지 rect 클립 live                                                                                     | 렌더 경로를 §8.5 표 기준 재분류                         |
| G5   | Phase 1·7    | **HC1**: 오버레이 증가분 프레임 예산 1% 이하 + 가이드 드래그 100 move 재현에서 canonical write/히스토리/persist 각 0 (finish 1회) | 렌더 캐시 (틱 라벨/paint) 보강 후 재측정                |
| G6   | 승격 시      | type-check + 신규 유닛·정적 가드 PASS + CHANGELOG                                                                                 | 승격 보류                                               |

## Consequences

### Positive

- 고정 기준선 authoring 이 생겨 스냅 체계 (ADR-179) 가 "미리 계획한 배치" 까지 확장 — Figma/Pen 동등 정렬 워크플로.
- 가이드가 문서 데이터라 undo·재로드·공유에서 다른 편집과 동일하게 동작 (ADR-177 과 같은 데이터 신뢰).
- 비-element 히스토리 entry 패턴이 3번째 적용으로 정착 — 이후 페이지 수준 authoring 데이터 (예: 페이지 색상 라벨) 의 선례 강화.

### Negative

- pointer 캡처 체인에 분기 1종 추가 — 회귀 감시 표면 증가 (R1 게이트로 상쇄).
- canonical 스키마 표면 +1 필드, 히스토리 kind +1 — 소비 분기 전수 관리 의무 지속.
- 오버레이 패스에 상시 렌더 2종 (ruler 틱 / 가이드 선) 추가 — G5 측정이 통과 조건이며, 통과 실패 시 캐시 보강이 선행 조건이 된다.
