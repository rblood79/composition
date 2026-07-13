# ADR-904: Fill SSOT + Preview/Publish 어댑터 전환

## Status

Implemented — 2026-04-24

> **승격 근거**: Round 1 리뷰 6건 (HIGH 2 + MED 2 + LOW 1 + 오탈자 1) 전수 반영 후 Round 2 에서 구조 10/10 PASS (HIGH 품질) + 코드 정합 7/7 VERIFIED + 누락 위험 0건 확인. 잔존 HIGH 위험 없음 → [ADR-063](063-ssot-chain-charter.md) Status 전이 규칙의 "Gate 없이 합의 완료" 경로로 Proposed → Accepted 승격. 후속 Status 전이(Accepted → Implemented)는 Phase 1~5 코드 land + Gates G1~G5 통과 시점.
>
> **리뷰 기록**: [docs/adr/reviews/904.md](../reviews/904.md) (Round 1 + Round 2)
>
> **구현 전이 근거**: Phase 1~5 코드 land 완료 후 후속 정리까지 반영됐다. `fillMigration` read-through, Fill commit/preview 경로의 derived background persistence 제거, shared `fillAdapter` 기반 Preview/Publish/Inspector consumer 정렬, Fill V2 feature flag retirement, Style Panel/store/update sink/AI/clipboard/import/add-element/preview-generated batch ingress canonicalization까지 완료했다. 비정형 `backgroundImage`/data URL 정책과 component-specific `backgroundColor` 예외 구분은 [ADR-905](905-fill-noncanonical-background-payload-policy.md)에서 완료됐다.

## Context

xstudio 시절의 저장 포맷은 DOM+CSS 편집 흐름을 중심으로 설계되어 `style.backgroundColor`, `style.backgroundImage`, `style.borderColor` 같은 CSS 속성 기반 모델이 우선이었다. 현재 builder 렌더 축은 WebGL/Skia 중심으로 이동했고, Fill 시스템(`color/image/linear/radial/angular/mesh`)이 이미 도입되어 있다. 그럼에도 저장·편집·미리보기 경로가 혼합되어 SSOT 경계가 불명확하다.

현재 코드베이스는 이미 아래의 하이브리드 상태를 보여준다.

1. Fill 타입 시스템이 별도로 존재하며 Pencil 계열 6종 Fill을 모델링한다.
2. Inspector/Store 저장 정본은 `fills`이며, CSS background 필드는 Preview/Publish adapter가 런타임에만 파생한다.
3. Preview 측 computedStyle 추출은 여전히 `backgroundColor/backgroundImage/borderColor`를 핵심 contract로 소비한다.
4. Fill V2는 feature flag로 부분 롤아웃 상태이다.

즉, 구조적으로는 Fill 중심으로 갈 수 있지만, Preview/Publish/Inspector 계약 때문에 CSS 필드를 즉시 제거하기 어렵다.

### SSOT 체인 위치 (ADR-063)

본 ADR 은 [ADR-063](063-ssot-chain-charter.md) 3-domain 분할 중 **D3 (시각 스타일)** 에 해당한다. Fill 을 D3 SSOT 로 승격하고, D1 (DOM/접근성, RAC 권위) 구조는 보전하며 D2 (Props/API) 는 기존 Inspector/Preview 계약을 adapter 로 유지한다. Fill 은 **Builder (Skia) 와 Preview/Publish (DOM/CSS)** 의 대등한 symmetric consumer 를 갖는 D3 direct source 로 정의된다 — 한쪽이 다른 쪽 기준 아님, 시각 결과 동일성만 계약.

### Hard Constraints

1. **런타임 시각 동일성**: 동일 문서에서 Builder(Skia)와 Preview/Publish(DOM)의 주요 컴포넌트 시각 회귀 0건(골든 비교 기준)이어야 한다.
2. **하위 호환성**: 기존 `style.backgroundColor`만 가진 프로젝트 로드 성공률 **100% 유지**. 영향 범위 수식화 —
   - 저장 포맷의 `style.{backgroundColor, backgroundImage, backgroundSize, borderColor}` 4 필드를 참조하는 **기존 모든 프로젝트 문서 (100%, 전수)**
   - 평균 재직렬화 대상: 요소당 최대 4 필드 × 문서 평균 element 수 (프로젝트 규모별). `fills` 부재 시 `ensureFills(backgroundColor)` read-through 로 Fill 단일 solid 변환 — 기존 저장 자체는 **쓰기 없이** 통과 (lazy migration, 신규 편집 시에만 fills 쓰기).
   - legacy 문서 호환: `fills` 부재 문서는 read-through 로 계속 열리고, 신규 저장은 `fills` 정본만 유지.
3. **Undo/History 보존**: Fill 편집 시 undo/redo 정확도(프리뷰 중 원본 스냅샷 포함)를 기존 대비 저하시키지 않아야 한다.
4. **전환 완료 후 단순화**: Fill consumer 경로는 최종적으로 플래그 없이 단일 계약으로 수렴해야 한다.
5. **경계 분리 유지**: Fill(면)과 Border(선) 모델을 혼합하지 않고 별도 채널로 유지해야 한다.

### Soft Constraints

- Pencil 포맷 유사성은 확보하되, composition 내부의 ADR-063 D1/D2/D3 경계를 침범하지 않는다.
- Preview/Publish DOM 경로는 CSS 기반 소비를 당분간 허용한다.
- 대규모 저장 스키마 재작성보다 adapter-first 전략을 우선한다.
- **CSSGenerator 경로와의 관계**: Fill↔CSS 파생은 CSSGenerator auto-gen 범위 **밖** (Inspector 액션 내부 `fillsToCssBackground()` 수동 동기화). [ADR-036](036-spec-first-single-source.md)/[ADR-059](059-composite-field-skip-css-dismantle.md) 의 Generator auto-gen 대상은 `spec.render.shapes` 기반 **정적 속성** (size/spacing/border tokens) 이므로, 런타임 **동적 인스턴스 값**인 `fills` 와 직교한다. Generator 자식 selector/variant emit 확장은 본 ADR 범위에 포함되지 않는다.

## Alternatives Considered

### 대안 A: Fill을 SSOT로 승격 + Preview/Publish는 어댑터로 변환

- 설명: 저장 정본은 `fills`로 통일하고, Preview/Publish에서만 `fills -> CSS background*` 변환 어댑터를 사용한다. Border는 독립 유지.
- 근거:
  - Figma/Pencil 계열 도구는 Fill/Stroke 분리 모델을 기본으로 사용한다.
  - 현 코드에 `fillsToCssBackground()` 및 preview-lightweight 경로가 이미 존재해 전환 비용이 낮다.
- 위험:
  - 기술: **M** — 어댑터 계층과 legacy CSS 경로 공존으로 일시 복잡도 증가
  - 성능: **L** — 드래그 중 lightweight preview 경로가 이미 존재
  - 유지보수: **M** — 전환 중 이중 계약 관리 필요
  - 마이그레이션: **M** — 기존 문서 read-through와 저장 경계 정리 필요

### 대안 B: 현행 유지 (CSS background/borderColor 중심 + fills 보조)

- 설명: 지금처럼 CSS style을 실질 정본으로 유지하고 fills는 UI 보조 데이터로 제한.
- 근거:
  - 단기 구현 리스크가 가장 작고 Preview/Publish 계약 변경이 거의 없음.
- 위험:
  - 기술: **H** — Skia/WebGL 확장 시 CSS 의미 체계 의존이 구조적 부채로 누적
  - 성능: **M** — 변환/동기화 중복 및 편집 경로 복잡화 지속
  - 유지보수: **H** — 동일 색상 의미가 다중 필드에 분산되어 버그 탐지 어려움
  - 마이그레이션: **M** — 뒤로 미룰수록 전환 비용 상승

### 대안 C: 즉시 빅뱅 전환 (CSS background 필드 제거)

- 설명: `backgroundColor/backgroundImage` 저장을 즉시 중단하고 모든 소비자를 Fill 직접 소비자로 교체.
- 근거:
  - 모델 순도는 가장 높고 장기적으로 코드 단순화 가능.
- 위험:
  - 기술: **H** — Preview/Publish/Inspector 계약 다수 동시 변경 필요
  - 성능: **M** — 급격한 변경으로 회귀 디버깅 비용 증가
  - 유지보수: **M** — 단기적으로 대량 핫픽스 가능성
  - 마이그레이션: **H** — 기존 문서 호환성/롤백 전략 취약

### Risk Threshold Check

| 대안 | 기술 | 성능 | 유지보수 | 마이그레이션 | HIGH+ 개수 |
| ---- | ---- | ---- | -------- | ------------ | :--------: |
| A    | M    | L    | M        | M            |     0      |
| B    | H    | M    | H        | M            |     2      |
| C    | H    | M    | M        | H            |     2      |

루프 판정: 대안 A는 HIGH 위험이 없어 채택 가능. B/C는 구조 또는 전환 리스크가 높아 기각한다.

## Decision

**대안 A: Fill SSOT + Preview/Publish 어댑터 전략**을 채택한다.

선택 근거:

1. 현 코드베이스가 이미 Fill 타입, Fill 액션, CSS 어댑터를 모두 갖춰 점진 전환의 발판이 준비되어 있다.
2. WebGL/Skia 중심 렌더 아키텍처와 데이터 모델 정합성이 가장 높다.
3. feature flag 기반 롤백이 가능하여 엔터프라이즈 운영 리스크를 통제할 수 있다.

기각 사유:

- **대안 B 기각**: 단기 안전하지만 구조 부채를 고착화한다.
- **대안 C 기각**: 단기 회귀·운영 리스크가 높아 현재 단계에서 과도하다.

> 구현 상세: [904-fill-ssot-preview-publish-adapter-breakdown.md](../design/904-fill-ssot-preview-publish-adapter-breakdown.md)

## Risks

선정 대안 A 는 Risk Threshold Check 에서 HIGH 0 으로 판정되었으므로 **잔존 HIGH 위험 없음**. 아래 R1~R5 는 모두 MED/LOW 수준이며 Gates 테이블로 1:1 관리한다.

| ID  | 위험                                                                                                                                     | 심각도 | 대응                                                                                                                             |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------- | :----: | -------------------------------------------------------------------------------------------------------------------------------- |
| R1  | 어댑터 변환 품질 저하로 Preview/Publish 시각 회귀 발생                                                                                   |  MED   | G1 + G4 — golden 비교 baseline + flag 점진 롤아웃으로 조기 차단                                                                  |
| R2  | `inspectorActions.ts:637/680` 의 drag preview vs commit 두 `fillsToCssBackground()` 호출 지점 동기화 누락으로 undo replay 시 시각 불일치 |  MED   | G2 — Fill 편집/프리뷰/커밋 경로를 단일 helper 로 수렴 + undo/redo 스냅샷 회귀 테스트에 경합 케이스 명시                          |
| R3  | `computedStyleExtractor.ts:71,72,81` Preview extractor contract 전환 방향성 미확정 → Publish 경로 debt 장기 누적                         |  MED   | G3 — consumer contract 문서에서 "어댑터 계약 유지 (CSS 계속 소비)" / "fills 직접 소비로 확장" 둘 중 하나를 Phase 3 종료 전 확정  |
| R4  | 전환 기간 동안 Fill 정본과 CSS 파생 소비 경계가 섞여 저장/런타임 책임이 불명확해질 위험                                                  |  MED   | G5 — 신규 문서 저장에서 derived background persistence 제거, Preview/Publish는 adapter 파생만 유지                               |
| R5  | Mesh-gradient 의 DOM CSS 완전 표현 한계 (다중 stop 보간 / angular blend)                                                                 |  LOW   | breakdown 오픈 이슈 #1 — Publish 산출물에서 SVG 또는 이미지 캐시로 폴백, Preview 는 단색 근사 허용, 완전 표현은 후속 ADR 로 분리 |

## Gates

| Gate               | 담당 Risks | 시점    | 통과 조건                                                                             | 실패 시 대안                          |
| ------------------ | ---------- | ------- | ------------------------------------------------------------------------------------- | ------------------------------------- |
| G1: Read-through   | R1         | Phase 1 | legacy `backgroundColor` only 문서를 로드할 때 `ensureFills` 경유 후 시각 회귀 0      | legacy fallback 유지 + migration 보강 |
| G2: Commit/Preview | R2         | Phase 2 | Fill 편집 시 `fills` 저장 + Preview state 회귀 0, derived background persistence 없음 | preview helper 재정렬                 |
| G3: Consumer Split | R3         | Phase 3 | Builder는 Fill 직접 소비, Preview/Publish는 어댑터 소비 계약 명문화                   | 계약 문서화 후 재시도                 |
| G4: Flag Rollout   | R1         | Phase 4 | Fill V2 점진 롤아웃(프로젝트/환경별)에서 장애율 목표치 이내                           | 플래그 기본값 off 유지                |
| G5: Legacy 축소    | R4         | Phase 5 | 신규 생성 문서의 derived `background*` persistence 제거                               | 저장 경계 재정의                      |

## Consequences

### Positive

- 색상/그래디언트/이미지/메시를 단일 Fill 모델로 다룰 수 있어 모델 일관성이 높아진다.
- Builder(WebGL/Skia)와 저장 모델의 의미 정합성이 향상된다.
- Preview/Publish는 어댑터를 통해 기존 CSS 계약을 유지하면서 전환할 수 있다.

### Negative

- Preview/Publish는 계속 CSS 파생값을 소비하므로 adapter 품질을 유지해야 한다.
- 어댑터 품질에 따라 Preview/Publish 회귀 가능성이 생긴다.
- 팀 내 도메인 경계(Fill vs Border) 규칙을 문서/리뷰로 강제해야 한다.

## Implementation Notes

- P1 Read-through 구현: legacy `backgroundColor` only 문서가 `ensureFills()` / `fillMigration` 경유로 편집 가능한 fill seed 를 얻는다.
- P2 Commit/Preview 구현: Fill 편집 commit/preview 경로가 `fills` 정본만 저장하고, Preview/Publish는 adapter로만 CSS 파생값을 소비한다.
- P3 Consumer Split 구현: Builder Skia 는 flag on 시 top-level `fills` direct-read, Preview/Publish/Inspector 는 shared adapter 기반 CSS 파생 style 을 소비한다.
- P4 Rollout 기준선 구현 후 후속 정리: Builder 편집 surface 와 Skia direct-read 는 현재 플래그 없이 Fill 경로를 기본 계약으로 사용한다.
- P5 Legacy 축소 구현: Style Panel direct background edit 차단, Modified Styles read-only 전환, AI tool surface `fills` 입력 수용, store/update sink 정리, clipboard/import/add-element/preview-generated batch canonicalization, Fill commit/preview 경로의 derived background persistence 제거까지 반영.
- 후속 분리: 비정형 `backgroundImage`/data URL payload 정책과 `RowEditor`/`CellEditor` 같은 component-specific `backgroundColor` 도메인 분리는 [ADR-905](905-fill-noncanonical-background-payload-policy.md)에서 완료했다.

## References

- [apps/builder/src/types/builder/fill.types.ts](../../../apps/builder/src/types/builder/fill.types.ts)
- [apps/builder/src/builder/stores/inspectorActions.ts](../../../apps/builder/src/builder/stores/inspectorActions.ts)
- [apps/builder/src/builder/panels/styles/utils/fillMigration.ts](../../../apps/builder/src/builder/panels/styles/utils/fillMigration.ts)
- [apps/builder/src/preview/utils/computedStyleExtractor.ts](../../../apps/builder/src/preview/utils/computedStyleExtractor.ts)
- [apps/builder/src/utils/featureFlags.ts](../../../apps/builder/src/utils/featureFlags.ts)
- [docs/adr/063-ssot-chain-charter.md](063-ssot-chain-charter.md)
