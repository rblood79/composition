# 차트 확장 ADR 전 기준·대상 항목 점검

2026-09-10 · 코드 기준 `305e4c4f7` · 조사 시작 worktree clean. **설계 전 조사 완료, 아래 범위는 권고안이며 신규 ADR/구현 승인이 아니다.** 제품 코드를 수정하지 않았다. 코드 정독 및 공식 문서 대조이며 새 build/test/live·픽셀 비교는 실행하지 않았다.

## 1. 이번 조사와 이전 분석의 관계

[ADR-209 후속 §1.1](../../adr/design/209-chart-followup-repair-breakdown.md#11-이번-후속-보완의-경계)은 D2–D4/C1–C7/V1–V6/X1–X5를 별도 확장으로 남겼다. 현재 추적 문서에서 그 번호별 원래 상세 표는 찾지 못했다. 확인 가능한 항목명(필드 타입 안내, 여러 수치 컬럼, 메타데이터, formatter, 축/tooltip/legend, 표현, 필터/선택/템플릿)을 기준으로 아래 E01–E24를 새로 부여한다. 이전 번호와 일대일 대응을 추정하지 않는다.

ADR-209는 완료 상태로 유지한다. 완료 범위는 시리즈 해제·기존 편집 계약 및 runtime 분리/검증이고, 이번 조사는 새로운 저작 기능의 범위를 정한다. [B안 승인 조건](../../adr/design/209-chart-followup-repair-breakdown.md#108-b안-승인-및-g5g6f5-종결-2026-09-10)은 새 초기 번들 변경 시 재측정을 요구하며 확장 비용까지 자동 승인하지 않는다.

## 2. 레퍼런스의 역할과 확인 범위

- **shadcn: 표현 및 예제 기준.** [Chart 문서](https://ui.shadcn.com/docs/components/base/chart)는 Recharts 구성에 chart config, tooltip, legend를 결합한다. config의 이름·색상·테마 정보와 행 데이터는 분리된다. 코드를 복제하거나 shadcn UI 패키지를 추가 설치하는 요구는 아니다.
- **Recharts: 실제 API 기준.** [XAxis](https://recharts.github.io/en-US/api/XAxis/)의 tickFormatter/축 type, [Tooltip](https://recharts.github.io/en-US/api/Tooltip/)의 formatter/labelFormatter를 확인했다. 설치 버전은 `packages/shared/package.json:75`의 **3.10.1**이다. 온라인 최신 API 전체를 설치 버전에서 지원한다고 가정하지 않는다. local `types/component/DefaultTooltipContent.d.ts:41`, `:45`, `types/cartesian/Bar.d.ts:85`에서 formatter/labelFormatter/name을 확인했다. 신규 API는 ADR spike에서 pinned 버전으로 재검증한다.
- **Composition: 데이터·편집·접근성·스타일 계약.** 공통 collection을 읽고 canonical/history/export를 유지한다. Builder 정적 Canvas와 Preview/Publish Recharts는 같은 데이터 의미와 시각 토큰을 소비한다. hover·키보드 상호작용은 runtime에서 검증한다.

공식 예제 목록도 [Area](https://ui.shadcn.com/charts/area), [Bar](https://ui.shadcn.com/charts/bar), [Line](https://ui.shadcn.com/charts/line), [Pie](https://ui.shadcn.com/charts/pie), [Radar](https://ui.shadcn.com/charts/radar), [Radial](https://ui.shadcn.com/charts/radial), [Tooltip](https://ui.shadcn.com/charts/tooltip)에서 대조했다. 예제 목록은 기능 발견의 근거이며 모든 예제의 코드·실제 픽셀을 검증한 것은 아니다. 시각 유사도 점수나 모든 예제의 완전 지원을 선언하지 않는다. 다음 설계의 P0에서 대표 예제 코드/스크린샷·크기·테마·데이터를 고정해야 한다.

## 3. 현재 코드 근거

경로는 repo root 기준, 줄 번호는 위 revision 기준이다.

| 근거                                                                               | 확인 사실                                                                                                 |
| ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `packages/specs/src/chart/types.ts:66`                                             | 단일 metric, 선택적 color 그룹 필드. 다중 metric 목록·시리즈 메타데이터·공개 format 설정 없음             |
| `packages/specs/src/chart/series.ts:47`                                            | 범주×그룹별로 단일 metric을 합산. 비수치/결측은 값 없음으로 유지. 범주/시리즈 순서는 첫 출현 순서         |
| 같은 파일 `:68`, `:82`                                                             | color 빈 값은 단일 시리즈. 팔레트 인덱스는 출현 순서로 배정                                               |
| `packages/specs/src/chart/runtimeData.ts:16`                                       | 공통 grid를 runtime rows로 투영. 내부 `series0` 등의 키는 원본 행 키와 구분. niceTicks 목표 5개           |
| `apps/builder/src/builder/panels/properties/chartFieldOptions.ts:42`               | 실제 Properties 옵션 생산자. Category/Value/Series에 컬럼 옵션과 현재 키를 유지                           |
| `apps/builder/src/builder/panels/properties/hooks/useOwnerCollectionColumns.ts:43` | schema key 또는 첫 행 key를 반환. 컬럼의 타입 정보는 반환하지 않음                                        |
| `packages/shared/src/catalog/bindings/Chart.binding.ts:123` 이후                   | 누적, 보간, 점, 값 라벨, 범주별 색, 반지름, radar grid, 축/격자/범례, animation 옵션 이미 노출            |
| `packages/specs/src/chart/authoring.ts:57`                                         | 6종 descriptor 및 built-in preset 존재. 사용자 저장 템플릿과는 다름                                       |
| `packages/specs/src/chart/computeChartScene.ts:332`                                | Pie·단일 시리즈 Radial·범주색 Bar의 legend는 범주 기준, 나머지는 시리즈 기준                              |
| 같은 파일 `:351`                                                                   | 값 라벨은 category 또는 formatTick. 사용자 formatter 설정 없음                                            |
| `packages/specs/src/chart/scales.ts:148`                                           | en-US, 소수 최대 2자리 고정. Builder UI 번역과 데이터 표시 locale은 별도 문제                             |
| `packages/specs/src/chart/legend.ts:72`                                            | legend 배치/줄바꿈 및 사각 swatch 구현. 사용자 icon/indicator 설정 없음                                   |
| `packages/shared/src/components/chart/RechartsChart.tsx:236`                       | Tooltip 자체 content가 원본 그룹 이름과 formatTick을 읽음. 공개 tooltip 표현 설정은 현재 showTooltip 중심 |
| 같은 파일 `:421`, `:463`, `:467`                                                   | series index 기반 색, connectNulls false, Area opacity 고정값. 범용 Recharts 옵션 편집기 아님             |
| `packages/shared/src/components/Chart.tsx:283`                                     | useCollectionData로 boundRows를 읽고 미연결일 때만 data 사용. chart 전용 fetch를 추가할 필요 없음         |

**이미 존재하는 기능을 다시 구현하지 않는다:** 6종 팔레트, 종류별 Properties, 그룹 필드 기반 다중 시리즈, stacked/dodged/expand, curve 3종, 점/값 라벨, legend 위치, donut/합계, radar grid·fill·spokes, radial 각도, animation/reduced-motion, Series None, ko/en UI.

## 4. 대상 항목 매트릭스

상태: **구현**=관련 설정/소비 경로 존재, **부분**=기본형은 있으나 원하는 조절 범위 부족, **신규**=현재 공개 계약/패널에서 미확인. 이는 새 live 판정이 아니다. 우선순위는 P0=첫 ADR 착수 전 결정, P1=첫 ADR 권고, P2=다음 표현 확장, P3=별도 상호작용/템플릿 설계.

| ID  | 항목·레퍼런스                            | 현재 상태                         | 목표 사용자 동작                                      | 영향 범위                         | 통과 기준                                                               | 순서       |
| --- | ---------------------------------------- | --------------------------------- | ----------------------------------------------------- | --------------------------------- | ----------------------------------------------------------------------- | ---------- |
| E01 | 필드 타입 안내 — Composition 저작 UX     | 부분: key 선택만                  | 값 후보의 수치/날짜/불명 타입과 선택 불가 사유 확인   | collection schema 읽기·Properties | 현재 저장 key 유실 0, schema 없는 입력 fallback 유지                    | P1         |
| E02 | 여러 수치 컬럼 — shadcn multiple/dataKey | 신규: 단일 metric+그룹만          | 한 테이블의 desktop/mobile을 각각 시리즈로 추가       | D2·공통 grid·두 renderer·패널     | 동등한 long/wide fixture의 값과 기하 일치, 원본 rows 불변               | P1         |
| E03 | 그룹 모드와 컬럼 모드 전환               | 신규                              | 그룹 필드 방식과 여러 값 컬럼 방식을 명시적으로 구분  | D2·편집/history                   | 전환/Undo/리로드 시 설정 손실 0, 두 모드 암묵적 교차곱 없음             | P0/P1      |
| E04 | 시리즈 이름 — chart config               | 신규                              | 원본 key를 유지하면서 사용자 표시명 설정              | D2·legend·tooltip                 | 동일 표시명이 두 시리즈여도 identity 충돌 0                             | P1         |
| E05 | 시리즈 색상·순서 — chart config          | 부분: 팔레트/출현 순서            | 시리즈별 토큰 색과 표시 순서 지정                     | D2→D3·Canvas·DOM                  | 데이터 행 순서 변경 뒤 지정 색/이름 유지, light/dark 대조               | P1         |
| E06 | 결측·중복·집계 의미                      | 구현/확장 결정 필요               | 기존 sum/결측 계약을 다중 컬럼에도 이해 가능하게 적용 | grid                              | 중복 합산/음수/0/null 손계산 일치, 평균 등 신규 집계는 범위 제외        | P0/P1      |
| E07 | 숫자·통화·비율 형식                      | 부분: 고정 숫자 포맷              | 소수 자리·통화 코드·비율 단위 설정                    | formatter·축/라벨/tooltip         | 값/기하 불변, 0.25→25%와 정규화25→25% 구분                              | P1         |
| E08 | 표시 locale                              | 부분: UI ko/en와 숫자 locale 분리 | 명시 locale 또는 문서 기본값 사용                     | 저장·runtime locale               | export를 다른 브라우저 locale로 열어도 명시 정책대로 표시               | P0/P1      |
| E09 | 날짜 표시·시간축                         | 신규: 범주 문자열                 | 날짜 포맷·타임존·시간 간격 의미 설정                  | scale·정렬·format                 | 불규칙 날짜 간격과 DST fixture; 단순 문자열 포맷과 연속축 구분          | P2         |
| E10 | 축 세부 설정 — XAxis/YAxis               | 부분: showAxis                    | 축별 제목/선/눈금/간격 설정                           | 기하·패널·양쪽 renderer           | 작은 크기·긴 라벨에서 clipping/충돌 기준 및 축별 표시 검증              | P2         |
| E11 | domain·기준선·이중 축                    | 신규 공개 옵션                    | 범위와 비교 기준 지정                                 | scale·기하                        | 범위 밖 값/음수/상하한, 서로 다른 단위의 잘못된 합산 방지               | P2         |
| E12 | Tooltip 구성 — shadcn tooltip            | 부분: on/off·고정 content         | 제목·이름·값·indicator 구성                           | runtime UI·D2                     | hover/키보드에서 설정 적용, canonical write 0                           | P2         |
| E13 | Legend 표현 — shadcn legend              | 부분: 표시/위치·사각 swatch       | indicator·icon·밀도·정렬 설정                         | legend 기하·D3                    | 동일 메타데이터 사용, 줄바꿈/overflow 검증                              | P2         |
| E14 | Legend 선택·시리즈 숨김                  | 신규 차트 옵션                    | 범례로 표시 대상 전환                                 | runtime interaction               | 키보드 조작·focus 유지, 편집 문서 불변, tooltip/scale 정책 명시         | P3         |
| E15 | Bar 표현 — label-custom 등               | 부분: 방향/누적/범주색            | 끝점별 radius·간격·label 위치                         | marks·D3·패널                     | 음수/누적 모서리/좁은 공간의 기하 대조                                  | P2         |
| E16 | Line/Area 표현 — dots-custom 등          | 부분: curve/dots·고정 opacity     | 점 크기/형태·선 dash·fill opacity                     | marks·D3                          | 곡선 중간점/결측 연결 정책·active mark 분리 검증                        | P2         |
| E17 | Pie/Donut 표현 — label-custom/active     | 부분: donut/합계·라벨             | 구분선·label 배치·중앙 문구 설정                      | polar 기하·text                   | 작은 조각/다중 링·중앙 공간 overflow, 범주 identity 보존                | P2         |
| E18 | Radar/Radial 표현 — shape/custom         | 부분: grid/각도/누적 존재         | 마크/링/라벨 세부 조절                                | polar 기하                        | 음수/결측·각도·누적 fixture, 두 renderer 의미 일치                      | P2         |
| E19 | 필터·기간 선택 — interactive 예제        | 신규 차트 전용 UX                 | 기존 데이터 제어 컴포넌트로 기간 변경                 | 공통 데이터·interaction           | Chart/ListBox 동일 필터 결과, Chart 전용 fetch/store 0                  | P3         |
| E20 | Brush/zoom·cross-chart 연동              | 신규 차트 옵션                    | 범위 선택과 다른 차트 연결                            | runtime·event 계약                | 선택 범위/키보드/메시지 경계 검증, canonical 임시상태 유입 0            | P3         |
| E21 | 카드 제목·설명·footer — 예제 구성        | 조합으로 평가 필요                | 기존 Card/Text와 Chart를 묶기                         | composition template              | 차트 props에 중복 컨테이너 책임을 넣지 않고 동일 정보 구성              | P3         |
| E22 | 사용자 템플릿                            | 부분: built-in preset만           | 표현 설정을 재사용·저장                               | template/export                   | 데이터 binding 덮어쓰기 금지, 생성/Undo/호환 정책 검증                  | P3         |
| E23 | 접근성                                   | 구현 기반 유지                    | 새 필드·시리즈 편집을 키보드로 수행                   | Properties·runtime                | 포커스/오류 설명/번역, 색 외 이름 식별, reduced-motion 유지             | 모든 phase |
| E24 | 성능·기존 문서 호환                      | 기존 게이트 유지                  | 기존 차트가 설정 없이 그대로 열림                     | 전 경로                           | legacy/ref/Undo/export PASS, 정적200행≤100ms, BuilderΔ≤1ms, 번들 재측정 | 모든 phase |

E01/E03/E06/E08/E23/E24는 예제 외관을 복제해서 얻을 수 없는 Composition의 추가 계약이다. shadcn의 모든 스타일을 동일하게 보이게 하는 일과 데이터 편집 기능의 완료를 혼동하지 않는다.

## 5. 첫 ADR의 권고 범위

권고 제목: **차트의 다중 수치 컬럼 매핑과 시리즈 표시 계약**. 번호는 아직 배정하지 않는다.

포함: E01–E08, E23/E24. 다만 E07은 숫자/통화/퍼센트와 명시 locale로 제한한다. 축·값 라벨·tooltip에 동일 표시 규칙을 연결하는 데 필요한 소비 경로는 포함하되, 축/tooltip 자체의 레이아웃 옵션은 포함하지 않는다.

- 새 wide 입력은 우선 **Bar·Line·Area·Radar 4종**을 대상으로 한다. 같은 단위의 여러 측정값을 비교하는 요구부터 해결한다.
- 기존 long 입력 및 `dimension/metric/color`, 공통 collection 공급은 **6종 모두 호환 유지**한다. Pie/단일 Radial의 색은 범주 의미이므로 E05를 무조건 시리즈 편집기로 적용하지 않는다. 범주별 메타데이터 및 wide→다중 링/호 해석은 E17/E18에서 결정한다.
- 다중 컬럼과 그룹 필드를 동시에 쓰는 교차곱, 혼합 단위/이중 축, 날짜 연속축, 자유 JavaScript formatter, 임의 SVG/React 컴포넌트 입력은 제외한다.
- 표시명이 원본 컬럼명을 바꾸거나 소비용 `series0`을 영속 identity로 저장하는 설계는 피한다. identity·색상 참조·순서의 구체 저장 구조는 아직 결정하지 않는다.

**대안 비교:** (A) formatter만 먼저 추가하면 범위는 작지만 다중 컬럼과 시리즈 이름 문제를 남긴다. (B) E01–E08의 데이터/표시 공통 계약을 먼저 묶으면 실제 비교 차트를 만들 수 있고 후속 축/tooltip의 중복 설계를 줄인다. (C) 표현·상호작용까지 모두 묶으면 scale/selection/template까지 저장·기하 경계가 커진다. 이번 권고는 B이며 ADR의 위험·대안 검토에서 재평가한다.

## 6. 설계에서 먼저 닫아야 할 결정

| 결정                    | 현재 제약·위험                                                                                  | 권고되는 확인 방법                                                                                           |
| ----------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| 모드와 저장 호환        | 기존 color 빈 문자열은 명시적 해제/override 계약. 새 모드가 삭제 의미로 오해되면 ref가 깨짐     | legacy→새 모드→Undo→reload 실제 store spike                                                                  |
| 시리즈 identity         | 현재 숫자/문자 범주는 String으로 합쳐질 수 있고 색은 출현 순서. 표시명만 identity로 삼으면 충돌 | `1`, `"1"`, 빈 값, `reset`, 같은 표시명, 재정렬 fixture; 기존 의미 변경 여부 명시                            |
| 집계                    | 같은 범주·그룹의 중복 sum을 wide 각 컬럼에 일관되게 확장해야 함                                 | 동등 long/wide 표를 손계산하여 grid·runtime 모두 대조                                                        |
| 단위/정규화             | expand는 이미 0–100 단위, 일반 Intl percent는 비율을 받음                                       | raw/normalized/display를 구분, 25가 2500%가 되지 않는 검사                                                   |
| locale 원천             | Settings는 편집 UI 설정이며 독립 publish의 값 표시 locale 계약이 아님                           | chart/document locale 우선순위와 default를 결정, 브라우저 언어 차이 테스트                                   |
| schema 신뢰             | 컬럼 추론은 첫 행만으로 타입을 확정하기 어려움                                                  | schema 타입/미지 타입을 구분, 키를 자동 삭제하거나 변환하지 않음                                             |
| 공통 바인딩 후속과 관계 | ADR-152의 stable collection/field 식별자 전환과 차트 설정이 충돌할 수 있음                      | 새 chart 전용 collectionId resolver를 만들지 않고 기존 읽기/쓰기 경계를 사용; rename 지원은 별도 의존성 표기 |
| 시각 동등성             | format 길이가 커지면 동일 좌표여도 라벨/legend가 넘침                                           | 고정 크기·긴 한글/통화·dark·padding·resize 양쪽 비교                                                         |

## 7. 대표 fixture와 성공 기준

1. **동등한 데이터 형태:** wide `{month:"Jan", desktop:120, mobile:80}`, `{month:"Feb", desktop:40, mobile:10}`와 같은 의미의 long 4행. 시리즈별 값 120/40, 80/10; 범주 합계 200/50. 원본 행 변환 저장 0.
2. **중복/결측:** Jan desktop 100+20=120; null은 값 없음, 실제0은 0. 음수·비수치·누락 컬럼을 포함하고 현재 sum/결측 정책을 유지한다.
3. **메타데이터:** desktop 표시명 데스크톱, mobile 모바일. 이름을 같게 바꿔도 시리즈2개 유지. 행 순서를 뒤집고 다시 로드해도 지정 색/순서는 유지한다.
4. **표시만 변경:** 같은 raw 1234.5를 소수1자리/통화로 바꿔도 bar 높이·집계 값은 불변. raw ratio 0.25와 expand 25의 기대 문자열을 명시한다. formatter 함수 자체를 문서에 저장하지 않는다.
5. **실제 저작 흐름:** Data 패널에서 테이블→Chart 배치→실제 필드 선택→수치 컬럼 추가/삭제/순서→이름/색/형식→Undo/Redo→save/reload→Preview→독립 Publish. 가짜 옵션만 주입한 unit test로 끝내지 않는다.
6. **호환:** 기존 6종·legacy 미설정/color 빈 값·ref override·source 재연결·Export/Import. chartType 전환 시 지원되지 않는 wide 설정 처리도 미리 정의한다(자동 데이터 손실 금지).
7. **정합:** 4종 wide의 Canvas/실제 Recharts 기하 주요점 및 곡선 중간점 허용치 ≤1px, 동일 표시 문자열, 라벨 overflow 정책. 다른 2종은 기존 계약 회귀 검사. hover/키보드 tooltip은 runtime, Canvas는 정적 결과로 검증한다.
8. **비용:** clean before/after original lockfile, initial/lazy closure 전수, 실제 로그인 production 부트의 Recharts 요청 0, 200행×시리즈수 및 5000행 불리 조건. 다중 수치 컬럼으로 마크 수가 증가하므로 행 수만 같은 성능 비교는 금지한다. ADR-209 예산 예외를 재측정 없이 연장하지 않는다.

## 8. 다음 착수 순서와 남은 불확실성

다음은 신규 ADR 작성의 입력으로 이 문서를 사용한다. P0에서 (1) pinned shadcn 대표 multiple/tooltip 예제 코드와 화면, (2) wide 4종 표현 spike, (3) 저장 모드/ref 호환, (4) formatter locale·정규화 계약을 확인한 뒤 설계 Decision을 확정하는 순서가 적절하다. 이 문서 작성만으로 새 기능을 착수하거나 별도 ADR을 생성하지 않았다.

이번 단계에서 미검증: 전체 shadcn 예제 픽셀 차이, 모든 최신 Recharts API의 pinned 지원 여부, wide/formatter의 실제 구현 가능성·성능 수치, 새로운 저장 schema. 현재 기능 판정은 위 코드 경로의 존재에 근거하며 재현 없는 신규 버그를 확정하지 않는다.

## 후속 설계

이 조사에 따른 [ADR-210](../../adr/210-chart-multi-field-series-presentation.md)과 [상세 설계](../../adr/design/210-chart-multi-field-series-presentation-breakdown.md)를 Proposed로 작성했다. 리뷰·P0 실증·제품 구현은 아직 실행하지 않았다.
