# ADR-207 구현 상세 — 극좌표 차트 (radar · radial)

> 본문: [207-polar-chart-radar-radial.md](../207-polar-chart-radar-radial.md)

## 1. 전제 lock-in (fork 4 질문 — 2026-09-08 사용자 confirm)

ADR-194 의 잔여 영역 분리이므로 `.claude/rules/adr-writing.md` §"ADR Fork / 분리 결정 시 전제·관점 점검" 4 질문을 통과한 뒤 작성했다.

1. **base / 응용 분류**: **ADR-194 = base** (기하 SSOT + `PathShape` + 대칭 consumer, Implemented 2026-09-08), **본 ADR = 응용** (그 기반 위의 새 `chartType` 2종). ADR-194 가 본 ADR 의 prerequisite 이며 역방향은 성립하지 않는다.
2. **schema 직교성**: 직교가 아니라 **specialization** 이다 — `ChartScene` 을 극좌표로 확장하므로 본 ADR 이 base 의 후속이다. 그래서 확장은 **가산적**이어야 한다 (HC2).
3. **선행 ADR 전제 reverse 검증**: ADR-194 의 전제("기하 함수 하나가 기준, 두 consumer 는 좌표를 복사만")는 그대로 유효하고 극좌표에서도 강화된다. 재시험되는 전제는 **축 레이블 회전 부재** 하나뿐이며, §3-4 에서 앵커 6방향으로 충분함을 확인해 ADR-194 의 비스코프를 유지한다.
4. **codex 3차 미루지 않기**: fork 시점(작성 직후) 에 review round 1 진입. Phase 착수는 리뷰 승인 후.

**사용자 confirm (2026-09-08)**: "radar/radial 을 ADR 몇 개로 나눌까요?" → **단일 ADR-207** 선택. 근거로 제시된 차단 카테고리는 `consolidation-burden` (ADR 개수 증가 = 통합·추적 부담), `no-derived-adr-mid-execution` 은 사용자가 `/create-adr` 를 직접 열었으므로 해당 없음.

## 2. Phase 0 — 코드 사실 표 (2026-09-08 실측, HEAD `bcee0ede8`)

| # | 사실 | 경로:라인 | 확인 명령 |
| --- | --- | --- | --- |
| F1 | `ChartType` 은 4종 문자열 유니온 | `packages/specs/src/chart/types.ts:14` | `sed -n '14p' packages/specs/src/chart/types.ts` |
| F2 | `AxisScene.axis` 는 `"x" \| "y"` 2종 | `types.ts:155` | `sed -n '154,162p' packages/specs/src/chart/types.ts` |
| F3 | `AxisScene.grid` 는 `LineMark[]` — **원·다각형을 담을 수 없다** | `types.ts:159` | 같음 |
| F4 | `buildAxes` 는 무조건 `[categoryAxis, valueAxis]` 2개를 낸다 | `axes.ts:193-195` | `sed -n '193,195p' packages/specs/src/chart/axes.ts` |
| F5 | 축 레이블 회전은 없다 — Skia `TextShape` 에 회전 필드 자체가 없다 | `axes.ts:1-6` 머리말 · `packages/specs/src/types/shape.types.ts` (`rotat` 검색 0건) | `grep -c rotat packages/specs/src/types/shape.types.ts` |
| F6 | 극좌표 헬퍼가 이미 있다 — `polar()` (12시=0, 시계) · `arcSlicePath()` (고리 조각, evenodd) | `marks/pie.ts:56-119` | `grep -n "function polar\|function arcSlicePath" packages/specs/src/chart/marks/pie.ts` |
| F7 | 극좌표 툴팁 히트가 이미 있다 — `buildRadialTooltip` + `hitTooltipBand` 의 각도 분기 | `tooltip.ts:88-170` | `grep -n "buildRadialTooltip\|angleOf" packages/specs/src/chart/tooltip.ts` |
| F8 | 범례 항목은 색을 가르는 축을 따라간다 (`byCategory`) — pie 와 bar-mixed 만 범주 | `computeChartScene.ts:128-130` | `sed -n '126,140p' packages/specs/src/chart/computeChartScene.ts` |
| F9 | 누적 계산은 `StackMode` 하나 (`none`/`stacked`/`expand`) 로 통일돼 있다 | `series.ts` `stackBands` / `stackRangesBySeries` | `grep -n "export function stackBands\|stackRangesBySeries" packages/specs/src/chart/series.ts` |
| F10 | Skia consumer 는 `rect`/`path`/`line`/`text` 4종만 안다 (`pushMark`) | `packages/specs/src/renderers/skiaPrimitives.ts` `chartScene` | `grep -n "const pushMark" -A 4 packages/specs/src/renderers/skiaPrimitives.ts` |
| F11 | DOM consumer 도 같은 4종 (`renderMark`) + `axes.grid` 를 `renderMark(line)` 으로 넘긴다 | `packages/shared/src/components/Chart.tsx` `renderChartScene` | `grep -n "renderChartScene" -A 8 packages/shared/src/components/Chart.tsx` |
| F12 | 기하 모듈 총 2,639 줄 / 13 파일 | `packages/specs/src/chart/**` | `wc -l packages/specs/src/chart/*.ts packages/specs/src/chart/marks/*.ts` |
| F13 | 등록 8지점은 이미 끝나 있다 — `chartType` 은 binding enum 값 추가뿐 | `packages/shared/src/catalog/bindings/Chart.binding.ts` `chartType.options` | `grep -n "chartType" -A 10 packages/shared/src/catalog/bindings/Chart.binding.ts` |
| F14 | 현재 게이트 규모 — 기하 단위 106 · 대칭 parity 64 · CanvasKit 픽셀 7 | `packages/specs/src/chart/__tests__/**` · `packages/shared/src/components/__tests__/chartParity.test.tsx` · `apps/builder/src/builder/workspace/canvas/skia/nodeRendererPath.integration.test.ts` | `pnpm -F @composition/specs exec vitest run src/chart` |

**F3 이 본 ADR 의 존재 이유다**: ADR-194 가 "chartType 추가 = 마크 파일 1개" 를 확장 기준으로 뒀는데 (`Chart.binding.ts` R5 근거 주석), radar 의 동심원 격자는 `LineMark[]` 에 안 들어가므로 그 기준을 넘는다.

## 3. 시스템 설계

### 3-1. 타입 델타 (가산 확장만)

```ts
// types.ts
export type ChartType = "bar" | "line" | "area" | "pie" | "radar" | "radial";
export type PolarGridType = "polygon" | "circle";       // shadcn radar grid-circle
export type AxisKind = "x" | "y" | "angular" | "radial";

export interface AxisScene {
  axis: AxisKind;                                       // 확장
  line: LineMark | null;
  grid: Array<LineMark | PathMark>;                     // 확장 (기존 소비처는 line 만 넣는다)
  ticks: TextMark[];
}

export interface ChartProps {
  // …기존
  gridType: PolarGridType;                              // radar 격자 모양
  // innerRadius 는 pie 도넛 것을 그대로 재사용 (radial 의 안쪽 반지름)
}
```

기존 4종의 좌표는 **1 byte 도 바뀌지 않는다** — `grid` 유니온은 담을 수 있는 것을 넓힐 뿐이고, `axis` 유니온도 기존 값을 유지한다. 스냅샷 4 + parity 64 가 이 불변식의 감시자다 (G1).

### 3-2. 극좌표 스케일 — `polar.ts` (신설)

| 심볼 | 뜻 |
| --- | --- |
| `angleScale(count, start=0, sweep=360)` | 범주 i → 각도 (12시=0, 시계). `bandScale` 의 극좌표 대응 |
| `radiusScale(domain, [inner, outer])` | 값 → 반지름. `linearScale` 의 극좌표 대응, **domain 하한은 0 으로 clamp** (R2) |
| `polarPoint(cx, cy, r, deg)` | 극좌표 → 화면 좌표. `marks/pie.ts` 의 `polar()` 를 여기로 올리고 pie 가 재사용 |
| `polygonPath(cx, cy, r, count, start)` | radar 격자·다각형 (닫힌 path) |
| `circlePathAt(cx, cy, r)` | radar 원형 격자. `marks/dots.ts` 의 `circlePath` 재사용 |

### 3-3. 마크

- **`marks/radar.ts`** — 시리즈당 닫힌 다각형 1개 (`fillSeries` + `strokeSeries`, area 와 같은 알파). 값 없는 범주는 **꼭짓점을 건너뛰지 않고** 중심(반지름 0) 으로 접는다 — 다각형은 닫힌 도형이라 subpath 를 나누면 도형이 깨진다 (line/area 의 끊기 규약과 갈리는 자리이므로 본문 R3 에 기록). 점 표시는 기존 `buildDotMarks` 재사용.
- **`marks/radial.ts`** — 범주(또는 시리즈)당 호 막대. 배경 트랙 호 + 값 호 2겹, 둘 다 `arcSlicePath` 재사용. 누적은 `stackBands`(F9) 를 각도 축에 적용.

### 3-4. 축 — `buildPolarAxes`

- **스포크** (radar): 중심 → 각 범주 방향 `LineMark`.
- **격자**: `gridType="polygon"` 이면 값 눈금마다 다각형 `PathMark`, `"circle"` 이면 원 `PathMark`. **여기가 F3 이 막고 있던 자리다.**
- **각도 레이블**: 각도별로 `anchor`/`baseline` 을 6방향으로 고른다 — 위(middle/bottom) · 우상~우하(start) · 아래(middle/top) · 좌상~좌하(end). **회전 불요** (F5 유지). Recharts `PolarAngleAxis` 기본 tick 도 수평이다.
- **반지름 축 눈금** (radial 의 `PolarRadiusAxis`): v1 은 중앙 텍스트만 (`showTotal` 재사용), 눈금 표시는 비스코프.

### 3-5. 두 consumer 델타

| leg | 변경 |
| --- | --- |
| Skia (`skiaPrimitives.chartScene`) | `axes[].grid` 순회가 `LineMark` 를 가정하던 자리를 `pushMark` 로 넘기면 끝 (`pushMark` 는 이미 4종 분기 — F10). 컴파일러가 누락을 잡는다 |
| DOM (`Chart.tsx renderChartScene`) | 같음 — `renderMark` 가 이미 path 를 안다 (F11) |

즉 **소비처 코드 변경은 각 1줄 수준**이고, 늘어나는 것은 기하 쪽뿐이다.

### 3-6. 툴팁 · 범례

- 툴팁: radar 는 각도 히트 (`buildRadialTooltip` 의 `center.inner=0` 형태로 재사용, F7), radial 은 호 히트 (반지름 밴드까지 봐야 하므로 `center` 를 링별로 확장).
- 범례: radar = **시리즈** (다각형이 시리즈), radial = **범주** (호가 범주) → `byCategory` 조건 (F8) 에 `chartType === "radial"` 추가.

## 4. Phase 분해

| Phase | 내용 | 산출 | Gate |
| --- | --- | --- | --- |
| **P0** | 인벤토리 freeze — §2 표 재확인 + 기존 4종 baseline 재측정 (스냅샷 4 · parity 64 · 기하 106) | 측정 기록 | G0 |
| **P1** | 극좌표 축 — `polar.ts` 신설 · `AxisScene` 가산 확장 · 두 consumer 결선 · `buildPolarAxes` | 기하 + 소비처 | G1 |
| **P2** | radar 마크 + `gridType` | `marks/radar.ts` | G2 |
| **P3** | radial 마크 (트랙 + 값 호 + 누적) | `marks/radial.ts` | G2 |
| **P4** | 결선 — binding enum 2종 · factory 기본값 · 툴팁 · 범례 축 · 값 레이블 | 등록 경로 | G3 |
| **P5** | 게이트 — 대칭 parity 케이스 추가 · 번들/프레임 측정 · live · 문서 | 게이트 + CHANGELOG | G4·G5 |

각 Phase 종료 시 commit 가능 상태를 유지한다. P1 이 유일하게 기존 파일을 건드리는 phase 이므로 여기서만 원복 RED 매트릭스를 전량 돌린다.

## 5. 검증 체크리스트

- [ ] **G0** — 기존 4종 baseline 기록 (스냅샷 4 · parity 64 · 기하 106 · 번들 gz 현재값)
- [ ] **G1** — 스키마 확장 후 기존 4종 좌표 **byte 무변경** (스냅샷 GREEN, 갱신 금지) + type-check 0 + 두 consumer 컴파일 통과
- [ ] **G2** — radar/radial 기하 단위: 좌표 유한성 (4종 경계 — 행 0 · 값 전부 비수치 · 크기 0 · 단일 범주) · 결정성 (같은 입력 = 같은 scene) · 반지름 음수 0건 · `d` 에 `NaN`/`Infinity` 0건
- [ ] **G3** — 대칭: parity 케이스 4개 추가 (radar polygon/circle · radial 단일/누적), path `d` **byte 동일**
- [ ] **G4** — 번들 각 앱 **+5KB gz 이내** · 200행 × 4시리즈 frame p95 **Δ ≤ +1ms** (불리 케이스 = 줌 드라이버, ADR-194 G4 하니스 재사용)
- [ ] **G5** — live: 팔레트에서 radar/radial 전환 → Skia 픽셀 변화 + Preview DOM (`polygon`/`circle` 격자 · 호 트랙) 양쪽 확인. **Skia 픽셀은 Compare Mode 를 끄고 먼저 잰다** (메모리 `feedback-compare-mode-halves-canvas-hides-area-delta`)
- [ ] CanvasKit 실픽셀 — 다각형 격자·호 트랙이 실제로 그려지는지 (`nodeRendererPath.integration.test.ts` 에 1건 추가)

### 측정 착수 전 5-질문 (`.claude/rules/measurement-validity.md` §1)

| # | 답 |
| --- | --- |
| Q1 출처 | 합성 데이터 (샘플 8행 + 200행 부하). **규모 전용** — 분포 지표 인용 금지 |
| Q2 불리 케이스 | 줌 드라이버 (캐시 불리) + 200행 × 4시리즈 + `gridType="circle"` (원 격자가 path 수 최대) |
| Q3 대조군 | 같은 프로젝트의 radar 추가 **전** arm (ADR-194 live 하니스와 같은 방식) |
| Q4 소비 경로 | binding enum → factory → 두 leg. `chartType` 은 이미 `propPassthrough` 에 있다 (F13) — emit 만 있고 받는 곳이 없는 형태가 아님을 P4 에서 live 로 확인 |
| Q5 oracle 독립성 | 기하 단위는 손계산 좌표 (12시=0 각도 규약), 대칭은 두 leg 의 `d` byte 대조, live 는 실제 브라우저 픽셀 — 셋 다 시스템 자신이 재생성한 golden 이 아니다 |

## 6. 위험 매핑

| Risk | Phase | Gate |
| --- | --- | --- |
| R1 `grid` 유니온이 두 consumer 의 기존 분기를 건드린다 | P1 | G1 |
| R2 극좌표에서 음수 값 → 반지름 음수 | P2·P3 | G2 |
| R3 radar 다각형의 결측 꼭짓점 규약이 line/area 와 갈린다 | P2 | G2 |
| R4 radial 각도 범위 prop 증식 | P3 | (v1 고정으로 회피) |
| R5 번들·프레임 예산 | P5 | G4 |
| R6 등록 경로 미결선 | P4 | G5 |

## 7. 비스코프 (v1)

- **반원 radial** (`endAngle=180`) — shadcn `chart-radial-stacked` 이 쓰는 형태. 각도 범위 prop 2개가 늘어나므로 후속 판정.
- **radar 축 레이블 회전** — 앵커 6방향으로 충분 (§3-4).
- **`PolarRadiusAxis` 눈금 표시** — 중앙 텍스트만.
- **custom shape / active 강조 / interactive** — 남은 shadcn 격차와 함께 별도 판정 (ADR-194 후속 절 참조).
