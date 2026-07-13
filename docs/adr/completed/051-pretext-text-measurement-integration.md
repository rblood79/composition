# ADR-051: 텍스트 측정 CSS 정합성 — Canvas 2D 내재화

## Status

Superseded by [ADR-900](900-unified-skia-rendering-engine.md) — 2026-04-08

Canvas 2D + CanvasKit 하이브리드 단일 소스 접근이 ADR-900 아키텍처에 통합됨. 별도 Pretext 레이어 없이 Unified Skia 경로에서 처리.

---

_원본 Status:_ Proposed — 2026-04-04

### 2026-04-05 패치 — Layout 보정 제거 + 렌더링 post-layout 교정

ADR-051 채택 전이지만, 대안 B의 핵심 원리(Canvas 2D = CSS = Layout SSOT)를 선행 적용:

- **Layout 경로**: `calculateContentWidth`, `fullTreeLayout Step 3.6`의 `+2/+4px` CanvasKit 보정 완전 제거
- **렌더링 경로**: `nodeRendererText.ts`에서 `paragraph.layout()` 후 `\n` 없는 단일줄 텍스트가 줄바꿈되면 `getMaxIntrinsicWidth() + 1`로 재layout
- **Break Hint**: Canvas 2D `measureWithCanvas2D()` → hintedText `\n` 주입 → CanvasKit 강제 (기존 구현)
- **결과**: Layout = Canvas 2D = CSS (보정 0px), Canvas 2D↔CanvasKit sub-pixel 차이는 렌더링 단에서만 교정

> 이 패치는 Phase 0 Go/No-Go 이전의 독립적 개선이며, ADR-051 전체 채택과 무관하게 유지됨.

## Context

composition는 3개 렌더링 타겟(CSS/DOM Preview, Skia/WebGL Canvas, PixiJS Event)을 가지며, 텍스트 렌더링에서 CSS↔Skia 간 구조적 불일치가 존재한다.

**근본 원인**: 측정과 렌더링 모두 CanvasKit(HarfBuzz WASM)을 사용하지만, 사용자가 비교하는 CSS Preview는 브라우저 네이티브 폰트 엔진을 사용한다.

| 경로            | 폰트 엔진                 | 줄바꿈 결정자       |
| --------------- | ------------------------- | ------------------- |
| CSS Preview     | 브라우저 네이티브 (Blink) | 브라우저 내장 ICU   |
| WebGL/Skia 측정 | CanvasKit (HarfBuzz WASM) | HarfBuzz + ICU WASM |
| WebGL/Skia 렌더 | CanvasKit (HarfBuzz WASM) | 위와 동일           |

**현재 증상**:

- CSS↔Skia 줄바꿈 일치율 ~90% — 서브픽셀 누적 오차로 줄 수 차이
- 리사이즈 시 ~85ms (500 텍스트) — WASM Paragraph 매번 생성/삭제
- Step 4.5 2-Pass re-enrich ~65ms — 동일 WASM round-trip
- 폰트 파라미터 해석 3곳 중복 (측정기, 렌더러, Spec 변환)

**Hard Constraints**:

1. 기본값 `overflow-wrap: normal` 유지 — `break-word` 전환은 좁은 컨테이너에서 문자 분할, 디자인 리듬 파괴 (v2에서 기각)
2. CanvasKit 렌더링 유지 — HarfBuzz glyph shaping 품질 필수
3. 60fps 프레임 버짓(16.67ms) 내 리사이즈 가능해야 함
4. 외부 라이브러리 의존 최소화

**Pretext 분석에서 도출된 인사이트**: Pretext(DOM-free 텍스트 측정 라이브러리)가 Canvas 2D `measureText()` + greedy line-breaking으로 CSS pixel-perfect 줄바꿈을 7,680 테스트 케이스에서 증명. Canvas 2D는 CSS Preview와 동일한 브라우저 네이티브 폰트 엔진을 사용.

> 상세 분석: [PRETEXT_ANALYSIS.md](../../explanation/research/PRETEXT_ANALYSIS.md)

## Alternatives Considered

### 대안 A: Pretext 라이브러리 직접 도입

- 설명: `@chenglou/pretext` v0.0.4를 vendor로 도입. `overflow-wrap: break-word` 경로에서만 SSOT로 사용, normal 경로는 CanvasKit fallback.
- 위험:
  - 기술: **HIGH** — v0.0.4 pre-1.0, #89 기본 영문 CSS 불일치, #96 CJK+숫자, #98 "$\_\_\_" 미해결, 66 open issues
  - 성능: LOW — `layout()` 0.0002ms/text (검증됨)
  - 유지보수: **HIGH** — vendor 관리, PR #82/#83 병합 추적, API 변경 이력 (`measureNaturalWidth` 제거)
  - 마이그레이션: MEDIUM — 이중 코드 경로(Pretext + CanvasKit) 유지 필요

- **SSOT 적용 범위**: ~29% (break-word 프리셋만) → PR #83 병합 시 ~43%
- **기각 사유**: 기본값 normal 유지 시 대부분 텍스트(~70-80%) 혜택 없음, 비용 대비 효과 불균형

### 대안 B: Canvas 2D 측정 내재화 (Pretext 원리 적용)

- 설명: Pretext의 핵심 원리(Canvas 2D `measureText()` + 세그먼트 캐시 + greedy line-breaking)를 composition 내부에 직접 구현. 외부 의존 0. 측정은 Canvas 2D(CSS와 동일 엔진), 렌더링은 CanvasKit(Break Hint `\n`으로 줄바꿈 강제).
- 위험:
  - 기술: MEDIUM — Canvas 2D `measureText()` vs CSS DOM 서브픽셀 차이 ~0.01-0.5px, CJK `Intl.Segmenter` 정확도 검증 필요
  - 성능: LOW — 캐시 warm 시 `computeLines()` ~0.01ms/text, 현재 대비 10-65× 개선
  - 유지보수: LOW — 신규 파일 1개(`canvas2dSegmentCache.ts`), 외부 의존 0
  - 마이그레이션: MEDIUM — `needsFallback()` 분기로 기존 CanvasKit fallback 유지, Phase별 점진 도입

- **Canvas 2D 적용 범위**: ~90% (normal + break-word + keep-all)
- **CSS 정합성**: ~90% → **~98%** (동일 브라우저 엔진)

### 대안 C: CanvasKit 경로 최적화만

- 설명: 기존 CanvasKit Paragraph 경로를 유지하고, 세그먼트 폭 캐시만 추가. `measureTokenWidth()` 결과를 `Map<fontKey, Map<token, width>>`로 캐시하여 WASM 호출 감소.
- 위험:
  - 기술: LOW — 기존 코드 최소 변경
  - 성능: MEDIUM — WASM 호출 50-80% 감소하나, Paragraph 생성/삭제 구조 자체는 유지
  - 유지보수: LOW — 캐시 1개 추가
  - 마이그레이션: LOW — 캐시 제거로 즉시 원복

- **CSS 정합성**: ~90% (변화 없음 — 여전히 다른 폰트 엔진)

### Risk Threshold Check

| 대안 | 기술   | 성능   | 유지보수 | 마이그레이션 | HIGH+ 개수 |
| ---- | ------ | ------ | -------- | ------------ | :--------: |
| A    | HIGH   | LOW    | HIGH     | MEDIUM       |     2      |
| B    | MEDIUM | LOW    | LOW      | MEDIUM       |   **0**    |
| C    | LOW    | MEDIUM | LOW      | LOW          |     0      |

- 대안 A: HIGH 2건 → **기각** (기술 + 유지보수 리스크 과다)
- 대안 B: HIGH 0건, MEDIUM 2건 → **수용 가능** (Phase 0 벤치마크로 잔존 MEDIUM 검증)
- 대안 C: HIGH 0건이지만 CSS 정합성 개선 없음 → 핵심 문제 미해결

## Decision

**대안 B: Canvas 2D 측정 내재화**를 선택한다.

선택 근거:

1. **CSS 정합성 구조적 보장**: Canvas 2D = CSS Preview와 동일 브라우저 폰트 엔진 → ~90% 텍스트에 ~98% 정합
2. **성능 대폭 개선**: 리사이즈 ~85ms → ~5ms, Step 4.5 ~65ms → ~1ms (추정, Phase 0 실측 확정)
3. **외부 의존 0**: Pretext 소스를 레퍼런스로만 참조, 라이브러리 미사용
4. **안전한 도입**: `needsFallback()` 텍스트 단위 분기 → letterSpacing, break-all, nowrap 등은 기존 CanvasKit 유지
5. **기존 아키텍처 호환**: `TextMeasurer` 인터페이스 그대로, 측정기 2개 유지, `isCanvasKitMeasurer()` 변경 불필요

기각 사유:

- **대안 A 기각**: HIGH 2건(기술 + 유지보수). v0.0.4 안정성 부족(#89/#96/#98), 기본값 normal 유지 시 SSOT ~29%만 → 비용 대비 효과 불균형
- **대안 C 기각**: CSS 정합성 개선 없음(~90% 유지). CanvasKit과 CSS가 다른 폰트 엔진인 근본 원인이 해결되지 않아 핵심 문제(줄바꿈 불일치) 미해결. 성능 개선도 제한적(WASM Paragraph 구조 유지)

위험 수용 근거 (잔존 MEDIUM 2건):

- Canvas 2D 서브픽셀 차이: Phase 0에서 100+ 텍스트 실측, 1px 초과 시 해당 패턴만 fallback 추가
- CJK `Intl.Segmenter` 정확도: Phase 0에서 한중일 50문장 검증, 불일치 발견 시 해당 세그먼트 보정

> 구현 상세: [051-canvas2d-text-measurement-breakdown.md](../design/051-canvas2d-text-measurement-breakdown.md)

## Gates

| Gate                 | 시점            | 통과 조건                                                         | 실패 시 대안                |
| -------------------- | --------------- | ----------------------------------------------------------------- | --------------------------- |
| **Phase 0 Go/No-Go** | Phase A 착수 전 | Canvas 2D vs CSS DOM width ≤ 1px (라틴 50 + CJK 30 + 혼합 20문장) | 대안 C로 전환               |
| **Phase 0 Go/No-Go** | Phase A 착수 전 | `Intl.Segmenter` CJK 분할 vs CSS 줄바꿈 일치 (한중일 50문장)      | CJK fallback 범위 확대      |
| **Phase 0 Go/No-Go** | Phase A 착수 전 | 세그먼트 캐시 warm 후 `computeLines()` ≤ 0.1ms (500 토큰)         | 캐시 구조 재설계            |
| **Phase A 완료**     | Phase B 착수 전 | `USE_CANVAS2D_MEASURE` 플래그 A/B 비교, 회귀 0건                  | 플래그 off → CanvasKit 원복 |
| **Phase C 완료**     | 배포 전         | Break Hint `\n` 후 CanvasKit 렌더링 시각 비교 통과                | Break Hint 플래그 off       |

## Consequences

### Positive

- CSS↔Canvas 정합성 ~90% → ~98% (동일 엔진, ~90% 텍스트 적용)
- 리사이즈 ~85ms → ~5ms, Step 4.5 ~65ms → ~1ms (추정)
- WASM Paragraph 측정용 생성/삭제 제거 → 메모리 GC 부담 감소
- 외부 의존 0, 번들 ~2KB 추가
- Pretext 재평가 시 `canvas2dSegmentCache` 모듈을 Pretext 어댑터로 교체 가능

### Negative

- 줄바꿈 알고리즘 자체 구현 → Pretext 수준(~99.9%)에는 미달 (~98%)
- Kinsoku(일본어 금칙), EngineProfile(브라우저별 shim) 미구현 → 일본어 ~95%
- `needsFallback()` 분기로 이중 코드 경로 유지 (letterSpacing, break-all 등)
- Phase 0 벤치마크 실패 시 대안 C로 전환해야 함 (1일 비용 발생)
