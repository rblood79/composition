# ADR-306: Recharts를 유지하는 Chart 36종 확장과 공개 size 제거

## Status

Proposed — 2026-11-10 (같은 날 설계 재작성)

- 사용자 원문: 「Recharts는 유지하고 size는 제거하는 방향으로 ztd-charts 36종을 제공할 수 있도록 chart 확장 ADR 작성해」.
- 확정 전제 3: Recharts 유지 · Chart 의 공개 S/M/L 제거 · ztd-charts 36종 제공. 구현 중 다시 묻지 않는다.
- 2026-11-10 재작성 (사용자 「review가 아닌 설계 자체를 검토후 전면 재설계 or 보완」): 첫 판은 저장소 정책과 어긋나는 문서 변환 절차를 넣었고, 핵심 구조 (새 종류가 DOM · Canvas 에서 무엇으로 그려지는가 · 첫 화면 번들에 무엇이 들어가는가) 를 정하지 않았다. 아래가 그 판을 대체한다. 바뀐 점은 breakdown §9.
- 선행: ADR-194 (공유 scene) · 209 (Recharts runtime) · 210 · 211 (표시 예산) · 215 · 216 · 217 (scatter). 문서 정본 ADR-248, 테마 ADR-302. 의존 방향은 그대로다 — 이 ADR 은 응용이고 선행 ADR 의 잔여 작업을 분리하지 않는다.

## Context

### 도메인

- **D1**: RAC 에 Chart primitive 가 없다. hover · 키보드는 ADR-209 의 Recharts runtime 경계가 소유한다 (Canvas 는 정적).
- **D2**: Chart 는 S2 에 없는 composition 확장이다. 새 필드 역할 · 옵션은 `Chart.binding.ts` 의 `accepts` 와 `d2Provenance.ts` 에 적는다.
- **D3**: 색 · 글자 · 기하는 catalog rule `Chart.chart` 채널과 theme token 이 정본이고 Canvas · Preview/Publish 가 대등하게 읽는다.
- 세 도메인을 같이 건드리는 이유: 새 필드 역할 (D2) 이 기하 (D3) 와 hover 대상 (D1) 을 함께 정한다.

### 코드 사실 (`c464b4fb7` 실측)

| #   | 사실                                                                                                                                                                                                                                                                                            | 근거                                                                                                 |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| F1  | canonical `ChartType` 은 7 (bar · line · area · pie · radar · radial · scatter). donut 은 pie 프리셋으로 이미 있다                                                                                                                                                                              | `packages/rendering/src/chart/types.ts:18` · `authoring.ts` pie presets                              |
| F2  | Canvas 는 `computeChartScene` 을 **동기 · 정적 import** 로 부른다. 7종의 기하 전부가 Builder 첫 화면 번들에 있다                                                                                                                                                                                | `packages/rendering/src/renderers/skiaPrimitives.ts:57,2708`                                         |
| F3  | DOM 은 `RechartsChart` 한 lazy chunk. scatter 는 Recharts 축을 `hide` 하고 축 · 격자 · 점을 **공유 scene 의 mark** 로 `Customized` 안에 그린다 — Recharts 는 container · 여백 · hover 문맥만 준다                                                                                               | `packages/shared/src/components/Chart.components.tsx:28` · `chart/RechartsChart.tsx:715-790`         |
| F4  | 모든 종류가 `resolveChartModel` → `buildSeriesGrid` (범주 × 시리즈 합산) 를 지난다. 표본 · OHLC · 연결 · 계층은 이 격자를 지나면 뜻을 잃는다 (`[1,9]` → 합 10)                                                                                                                                  | `chart/model.ts:182` · `series.ts:118` · `computeChartScene.ts:331`                                  |
| F5  | 공개 `size` 는 6곳에서 읽힌다: binding `accepts` + `propPassthrough` · DOM wrapper (`sizeKey` · `data-size`) · Skia (`props.size`) · 패널 2 (`ChartBudgetControls` · `useChartPropertyExtras`) · `createChartInitialProps`. rule 은 `sizes.S/M/L` (높이 160/240/320) 과 `metrics.S/M/L` 을 둔다 | `Chart.binding.ts:589,644` · `Chart.components.tsx:81-266` · `skiaPrimitives.ts:2718` · rule `Chart` |
| F6  | 문서 형식 정책: 「An earlier contract's document is refused, never re-mapped」 — 지금 64 (ADR-308, 2026-11-12 — 이 ADR 작성 때는 63). 변환 경로는 저장소에 없다                                                                                                                                 | `packages/shared/src/catalog/document/types.ts:158-160` · `graph.ts:580`                             |
| F7  | Builder 첫 화면 번들은 상한 1,414,000 B gzip 에 2 ~ 3 KB 남았고 (최근 기록 1,410,880 + 후속 몫) 상한은 2026-11-25 에 만료된다. Preview 는 327,000                                                                                                                                               | ADR-201 §initial 상한 재승인 · `apps/builder/scripts/adr201-bundle-gate.mjs`                         |
| F8  | ztd-charts 0.5.0 (`3c4376c`, MIT) 은 runtime 의존 0 의 SVG 구현이다. 36 항목 · 종류별 encoding 채널 · 옵션이 `spec/registry.ts` · `spec/meta.ts` 에 있고 통계 · 배치는 `layout/*.ts` 5 파일 959 줄 · `data/percentile.ts` 다                                                                    | pinned checkout                                                                                      |
| F9  | scene mark 는 Rect · Path · Text · Line 이고 색은 hex 가 아니라 **시리즈 인덱스** 다. 연속 색 · 상승/하락 · 강조 역할이 없다                                                                                                                                                                    | `chart/types.ts` Mark · `skiaPrimitives.ts:2660` 주석                                                |

### Hard constraints

- 36 항목 (ztd 0.5.0 registry) 전부에 생성 · 필드 지정 · Canvas · Preview · Publish · 저장 재열기 경로. 다른 종류로 조용히 대체하지 않는다.
- Recharts 3.10.1 유지. 기존 7종의 DOM 구현을 다시 쓰지 않는다. ztd 를 runtime 의존성으로 설치하지 않는다.
- 공개 `size` · `data-size` · S/M/L 편집을 없앤다. 실제 상자 치수 (`ChartSize {width,height}`) 는 그대로다. 이름만 바꾼 density prop 을 만들지 않는다.
- **문서 변환 코드를 만들지 않는다** (F6 + 사용자 지시 2026-10-14 「마이그레이션 기능 제공 금지」). `accepts` 에 없는 prop 은 무시되지 않고 거부된다 (`library.ts:351` · `graph.ts:1811` `PROP_NOT_ACCEPTED`) — 그래서 `size` 삭제는 typed 원본 수정과 contract 올림을 같이 한다 (Decision 7).
- Builder 첫 화면 번들: 새 종류의 통계 · 배치 · 기하 · sample 은 0 B. 들어가도 되는 것은 종류 목록과 등록 기구뿐이다 (F2 · F7).
- 통계는 표시 예산 (ADR-211 rowCap · markBudget) 적용 **앞** 에서 계산한다. 잘린 입력의 분위수를 전체 값처럼 보이지 않는다.
- 문서 변경은 catalog 명령 → `workspace.execute` 경로. hover · brush 같은 일시 상태는 저장하지 않는다.

### 생성기 선언

CSS 생성기는 `Chart` 의 size 선택자를 낸다 — 이 ADR 이 S/L 을 지우면 M 한 벌만 남는다. 새 종류의 도형은 전부 scene mark 라 자식 selector 를 늘리지 않는다. 새로 생기는 CSS 는 paint 역할의 색 변수 (`--chart-positive` 등) 뿐이고 생성기의 기존 `chart` 채널 변수 경로로 나간다.

## Alternatives Considered

비교 축은 「새 28 항목이 DOM 과 Canvas 에서 무엇으로 그려지는가」 다. size 제거와 문서 정책은 대안과 무관하게 같다.

### 대안 A: DOM 은 Recharts 기본 컴포넌트 (Funnel · Treemap · Sankey · SunburstChart …), Canvas 는 따로 구현

- 설치본에 export 가 있는 종류는 DOM 이 빨리 나온다.
- Recharts 의 배치 (squarify · sankey relaxation) 는 비공개 내부라 Canvas 가 같은 좌표를 얻을 수 없다 — 두 번째 알고리즘이 생긴다. export 가 없는 종류 (box · beeswarm · chord · calendar · waffle … 20종 안팎) 는 어차피 직접 그린다.
- 위험: 기술 HIGH / 성능 MEDIUM / 유지보수 HIGH / 마이그레이션 LOW.

### 대안 B: ztd runtime 을 DOM 렌더러로 설치

- DOM 결과를 그대로 얻는다.
- 「Recharts 유지」 에 어긋난다. 색 · 글자가 ztd theme 을 따라 D3 정본을 벗어나고, Canvas 는 여전히 따로 구현한다.
- 위험: 기술 MEDIUM / 성능 MEDIUM / 유지보수 HIGH / 마이그레이션 HIGH.

### 대안 C: 공유 scene + Recharts scene host + family 단위 지연 로드 (ztd 알고리즘 이식)

- 새 종류는 전부 「family 모듈의 순수 함수가 scene 을 만든다」. DOM 은 scatter 선례 (F3) 대로 축을 숨긴 Recharts container 안에 scene mark 를 그리고, Canvas 는 같은 scene 을 Shape 로 옮긴다. 기하는 한 번만 계산한다.
- 통계 · 배치는 ztd 의 MIT 소스를 고지와 함께 이식한다 (F8 — 959 줄). 새로 발명하지 않는다.
- family 5 개를 각각 chunk 로 나눠 Canvas · DOM 이 같은 모듈을 필요할 때 받는다. 기존 7종은 손대지 않는다.
- 위험: 기술 MEDIUM / 성능 MEDIUM / 유지보수 MEDIUM / 마이그레이션 LOW.

### 대안 D: 공유 scene + 새 종류는 Recharts 없이 평범한 `<svg>`

- C 와 계산층이 같고 DOM host 만 다르다. 축 없는 종류에는 Recharts container 가 주는 것이 적다.
- DOM 에 차트 runtime 이 둘이 된다 — tooltip 표면 · 반응형 container · animation 설정 · 창 트랙이 기존 7종과 갈라져 같은 수리를 두 번 한다. 사용자 전제의 「Recharts 유지」 를 기존 종류로만 좁혀 읽는 해석이다.
- 위험: 기술 LOW / 성능 LOW / 유지보수 HIGH / 마이그레이션 LOW.

### Risk Threshold Check

| 대안 | HIGH 이상               | 판정                               |
| ---- | ----------------------- | ---------------------------------- |
| A    | 기술 · 유지보수         | 두 소비자의 좌표가 구조적으로 갈림 |
| B    | 유지보수 · 마이그레이션 | 확정 전제 위반                     |
| C    | 없음                    | 채택                               |
| D    | 유지보수                | DOM runtime 이중화                 |

C 에 HIGH 가 없어 루프를 더 돌지 않는다. 「별도 ADR 로 나눌 수 있는가」: size 제거 (Phase 1) 는 독립이지만 사용자가 한 ADR 로 지시했고 작아서 나누지 않는다.

## Decision

**대안 C.** 근거는 F3 — 저장소가 scatter 에서 이미 같은 구조를 쓰고 있고 (ADR-217, 5,000 점 실측), 새 종류는 그 선례를 일반화한 것이다.

1. **36 제공 항목 = 기존 type 9 항목 + 새 chartType 27.** donut (pie 프리셋) · radialBar (radial + 명시 최댓값) · bubble (scatter + 크기 필드) 은 기존 type 의 프리셋 · 확장이고, 나머지 27 은 새 `chartType` 값이다. 판정 기준: 기존 scene builder 가 prop 만 달리해 그릴 수 있으면 프리셋, 새 builder 가 필요하면 새 type.
2. **family 5 개.** 새 type 27 을 입력 모양으로 묶는다 — category (12) · kpi (3) · distribution (4) · matrix (4) · network (4). family 모듈 하나가 자기 type 의 입력 검증 · 모델 · scene · sample 을 가진 순수 함수 묶음이고 chunk 하나다.
3. **격자를 지나지 않는다.** 새 type 은 `resolveChartModel` 의 시리즈 격자 (F4) 를 거치지 않고 원본 행을 family 가 직접 읽는다. 격자가 맞는 category family 만 `buildSeriesGrid` 를 호출해 쓴다.
4. **DOM = Recharts scene host.** `RechartsChart` 안에 「축을 숨긴 container + `Customized` 로 scene mark」 를 그리는 host 하나를 두고 새 type 전부가 쓴다. Recharts 기본 Funnel · Treemap · Sankey 등은 쓰지 않는다 (대안 A 의 이유).
5. **Canvas = 같은 scene, family 는 준비되면.** `chart_scene` 은 동기라 로드를 시작하지 않는다. 로드되지 않은 family 의 차트는 placeholder scene 을 내고, scene-node 층이 로드를 걸고 완료 시 그 노드를 다시 그리게 한다. 계산 memo 키에 「로드됨」 을 넣는다.
6. **paint 역할.** mark 의 색을 시리즈 인덱스 외에 역할 (accent · neutral · positive · negative · 단계 n) 로 실을 수 있게 한다. 연속 색은 보간하지 않고 **단계 토큰** 으로 양자화한다 — 두 소비자가 같은 토큰을 풀 뿐 색 계산식이 생기지 않는다.
7. **size 제거 = 삭제.** F5 의 6곳과 rule 의 S · L · `metrics` 크기 축을 지운다. rule 은 M 한 벌 (높이 240 · padding 12 · 기하 글자 11) 이 기본값이 된다. typed Chart 원본 (`generated/reusableOriginLibrary.ts:6135` 의 `size: "M"`) 과 공개 React 타입 (`Chart.runtime.ts:85`) 에서도 지우고 `LIBRARY_CONTRACT_VERSION` 을 64 → 65 로 올린다 (64 는 ADR-308 이 2026-11-12 에 썼다). **64 문서는 Chart 가 있든 없든 전부 열리지 않는다** (`UNSUPPORTED_LIBRARY_CONTRACT` — 저장소의 기존 정책, 변환 · 보존 절차 없음). 새로 만드는 차트의 기본 높이는 240 이다.
8. **ztd 옵션은 세 갈래로 분류한다.** 종류를 정의하는 것 (encoding 채널 · 데이터 뜻을 바꾸는 옵션) 은 채택, 기존 prop 에 대응이 있는 것은 그것으로 (referenceLines · valueFormat · legend · animation · 표시 예산), ztd runtime 고유 기구는 제외 (canvasThreshold · maxPoints · spring · ChartCard · CLI/MCP · 자동 설명 문장). 분류표는 breakdown §3.
9. **범위 밖**: ztd JSON spec 호환 API · 서버 이미지 export · LiveLineChart · StatCard.

기각 사유 — A: Canvas 가 Recharts 내부 배치를 공유할 수 없다. B: 전제 위반 + D3 이탈. D: DOM runtime 이중화.

> 구현 상세: [306-chart-36-types-recharts-size-removal-breakdown.md](design/306-chart-36-types-recharts-size-removal-breakdown.md)

### 사용자 결정 (2건 — 2026-11-10 확정 「1. 권고대로 포함 2. 상한승인」)

1. **공통 상호작용 (강조 · 주석 5종 · 범위 선택 · 차트 동기화) 을 이 ADR 에 넣는다.** ztd 의 종류가 아니라 line · area · bar · candlestick 에 걸친 공통 옵션이지만 「36종 제공」 의 예시 화면이 이 옵션을 쓴다. Phase 6 에서 구현하고 ADR 은 Phase 6 뒤에 닫는다.
2. **Builder 첫 화면 번들 상한 재승인.** 종류 목록 36 과 등록 기구의 몫을 Phase 2 에서 실측해 (F7 — 여유 2 ~ 3 KB · 만료 2026-11-25) 초과분만큼 ADR-201 상한을 올린다 — 다시 묻지 않는다. 상한은 두 곳에 따로 적힌 숫자라 **같은 커밋에서 둘 다** 고친다: `apps/builder/scripts/adr201-bundle-gate.mjs:29` `BUILDER_CEILING` · `.github/workflows/deploy.yml:93`. 실측값 · 새 상한은 ADR-201 재승인 절 · CLAUDE.md 성능 표 · CHANGELOG 에 적는다. 승인 범위는 종류 목록과 등록 기구뿐이다. 계산 코드 · sample 을 첫 화면에 넣는 완화는 포함하지 않는다.

## Risks

| ID  | 위험                                                                                       | 심각도 | 대응 · 코드 경로                                                                                                                                              |
| --- | ------------------------------------------------------------------------------------------ | :----: | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | family 로드 완료가 Canvas 다시 그리기로 이어지지 않아 placeholder 가 남음 · 옛 결과가 덮음 |  HIGH  | 준비 상태를 memo 키와 무효화에 연결 — `skiaPrimitives.ts` chartScene · `catalogRuntime/ruleShapes.ts` (`_chartRows` 주입) · `resolution/resolver.ts`. G2      |
| R2  | 새 prop 이 한 소비자에만 전달됨 (binding · DOM destructure · Skia allowlist 세 목록)       |  HIGH  | 세 목록을 descriptor 의 역할 정의 하나에서 파생 — `Chart.binding.ts:598` propPassthrough · `Chart.components.tsx:101` · `skiaPrimitives.ts:2676`. G3          |
| R3  | 이식한 통계 · 배치가 틀리거나 예산이 먼저 잘라 뜻이 바뀜                                   |  HIGH  | 손계산 fixture + ztd 순수 함수 출력을 차등 oracle 로 — family 의 model 단계 · `chart/budget.ts` · `chart/runtimeData.ts`. G4                                  |
| R4  | 첫 화면 번들 초과                                                                          |  MED   | family chunk 경계 + `adr201-bundle-gate.mjs` · `adr209-bundle-closure.mjs`. G1 · G2                                                                           |
| R5  | 생성 경로가 sample 로드 때문에 비동기가 되어 동기 호출자가 깨짐                            |  MED   | 로드를 명령 실행 **앞** 에서 기다리고 명령 · store action 은 동기 유지 (breakdown §4.4)                                                                       |
| R6  | contract 65 로 64 문서 전부가 열리지 않음                                                  |  MED   | 의도된 변경 (정책 F6). CHANGELOG 에 Breaking 으로 적는다. Phase 1 을 한 커밋으로 넣어 중간 상태 (원본에 `size` 가 남아 라이브러리 구성 실패) 를 만들지 않는다 |
| R7  | ztd upstream 변경                                                                          |  LOW   | 0.5.0 `3c4376c` 고정. 갱신은 따로 다룬다                                                                                                                      |

## Gates

측정 조건 (기기 · DPR · production build · revision) 을 증거에 적는다. 미실행 gate 를 PASS 로 적지 않는다.

| Gate | 시점        | 통과 조건                                                                                                                                                                                                                                                                                                                                                                                         | 실패 시 대안                                                                        |
| ---- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| G0   | Phase 0     | ztd 36 항목의 채널 · 옵션 전부가 채택 / 대응 / 제외로 분류된 fixture · 번들 기준선 (같은 기계 · 별도 worktree) · 선행 실패 3건 재현 여부. 착수 여부를 가르지 않는다 (기준선 고정)                                                                                                                                                                                                                 | fixture 보강                                                                        |
| G1   | Phase 1     | `size` · `data-size` 소비 0 (정적 검사) · `buildCodeCatalogLibrary()` 검증 통과 (원본에 `size` 0) · contract 65 · 64 문서와 `size` 가 든 65 문서가 각각 `UNSUPPORTED_LIBRARY_CONTRACT` · `PROP_NOT_ACCEPTED` 로 거부됨 · 기존 7종의 scene 이 size 미지정 입력에서 변경 전 M 과 같음 · 생성 CSS 에 Chart S/L 선택자 0 · live: Builder · Preview · Publish 에서 기존 차트 1개 리사이즈 · 번들 Δ ≤ 0 | 누락 소비처 수리                                                                    |
| G2   | Phase 2     | (불리한 경우) family 미로드 상태로 문서 열기 → placeholder → 로드 뒤 같은 프레임 주기 안에 실제 scene · 로드 중 데이터 변경 시 옛 결과 0 · 로드 실패 뒤 재시도. Builder 첫 화면 Δ 실측 → 초과분만 상한 갱신 (사용자 결정 2) · 새 type 이 없는 페이지의 chunk 요청 0                                                                                                                               | 준비 경계 수리. 계산 코드가 첫 화면에 섞였으면 chunk 경계 수리 (상한으로 덮지 않음) |
| G3   | family 마다 | 같은 입력의 scene 을 DOM host 와 Canvas 가 같은 mark 수 · 좌표 (≤ 0.5 px) · 토큰으로 그림 — 브라우저 `getBoundingClientRect` 대 scene 좌표 (외부 oracle). 320×240 · 640×360 · light/dark · 음수 · 0 · 결측 · 항목 1                                                                                                                                                                               | scene 쪽 수리. 소비자별 보정 금지                                                   |
| G4   | family 마다 | 손계산 fixture 일치 (breakdown §7.1) + ztd 순수 함수와 차등 일치 · 예산 초과 입력이 진단을 내고 통계를 잘린 값으로 내지 않음 · 종류마다 원복 RED 1                                                                                                                                                                                                                                                | 모델 수리                                                                           |
| G5   | Phase 5 · 6 | 36/36 census — 생성 · 필드 지정 · Canvas · Preview · Publish · 저장 재열기 · hover · 키보드. 실제 Builder 에서 family 마다 대표 1종 end-to-end + 사용자 confirm                                                                                                                                                                                                                                   | 빠진 항목 구현. 부분 완료를 완료로 올리지 않음                                      |

집행: `codex:preflight` 는 지금 Chart unit 을 돌리지 않는다 (`package.json:29` — 타입 · 등록 census · CSS 경계뿐). Phase 0 이 root script `test:chart-contract` (rendering 의 `src/chart` unit — 분류 fixture · 손계산 fixture · 전달 목록 정적 검사) 를 만들어 `codex:preflight` 사슬에 넣는다. 브라우저 좌표 비교 (G3) 는 자동 사슬에 넣지 않고 Phase 종료 때 직접 실행해 증거를 남긴다. 번들은 `adr201-bundle-gate.mjs` (push 전 Δ) 와 배포 workflow `deploy.yml` 의 절대 상한 (`push: main`). 새 pre-push 기구를 만들지 않는다.

### Live Exercise

미실행 — 설계 단계.

## Consequences

### Positive

- 새 종류의 기하가 한 번만 계산되어 Canvas · Preview/Publish 가 구조적으로 같은 그림을 낸다.
- 기존 7종과 그 테스트는 size 제거 외에 바뀌지 않는다.
- 차트 크기를 Layout 이 정하고 S/M/L 이 묶던 높이 · 여백 · 글자의 결합이 없어진다.
- 차트를 쓰지 않는 페이지의 번들은 늘지 않는다.

### Negative

- 통계 · 계층 · 흐름 배치 약 1,000 줄과 종류별 scene builder 를 저장소가 유지한다 (ztd 를 따라가는 갱신은 수동).
- contract 가 65 로 올라 기존 (64) 문서가 전부 열리지 않는다 (Breaking, 변환 없음 — 저장소 정책).
- 새 종류가 든 문서를 처음 열 때 Canvas 에 placeholder 가 한 번 보인다.
- 새 종류의 진입 animation 은 Recharts 가 아니라 host 가 맡는다 — 기존 7종과 움직임이 다를 수 있다 (breakdown §5.3).
