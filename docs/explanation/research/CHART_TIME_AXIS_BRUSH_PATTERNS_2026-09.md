# Chart 시간축 · 범위 선택 (brush) 이론 분석 — d3-time · d3-scale · d3-array · d3-brush (2026-09-12)

> 목적: 시간축 · 가변 창 (brush) ADR 을 설계하기 전에 d3 가 **무엇을 어떤 규칙으로** 계산하는지 소스에서 추출한다. 라이브러리는 가져오지 않는다 — `packages/specs/src/chart` 는 외부 의존 0 (ADR-194) 이고 Skia 가 같은 답을 내야 하므로 **이론·패턴만** 우리 모듈로 옮긴다. 선례: ADR-194 가 d3-path 의 "기하 = 렌더러 무관 path 문자열" 통찰만 채택했고, `scales.ts` `tickIncrement` 는 이미 d3-array 의 1·2·5 규칙을 그대로 이식한 것이다.
>
> 원천: d3-time · d3-scale · d3-array · d3-brush · d3-time-format `main` + react-spectrum-charts `vega-spec-builder` (D2 참조) (2026-09-12 shallow clone, 스크래치 로컬). 인용은 파일:함수 단위.

## 0. 우리 코드의 출발점 (실측)

| 우리 모듈                                     | 있는 것                                                                                                       | d3 대응                            |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| `scales.ts` `linearScale` · `bandScale`       | 값 축 선형, 범주 축 등간격                                                                                    | `continuous` · `band`              |
| `scales.ts` `tickIncrement` · `niceTicks`     | d3-array `tickSpec` 의 √50·√10·√2 규칙 이식 + 경계 4종 유한화 · nice domain                                   | `ticks` · `tickIncrement` · `nice` |
| `budget.ts` `parseIsoStrict`                  | 엄격 ISO-8601 → epoch ms, **UTC 기준** (tz 접미 보정), 달력 검사                                              | (d3 는 `new Date` 에 위임)         |
| `budget.ts` `resolveAxisKind`                 | 범주 전부 ISO + 단조이면 `ordinal` — 순서 판정에만 쓰고 **간격은 여전히 등간격**                              | —                                  |
| `windowTrack.tsx` · `layout.ts` 창 트랙       | RAC `Slider` thumb 1, `0 … n − fitEff`, 창 길이 불변, 뷰 상태 (canonical write 0), Canvas 는 비활성 트랙 마크 | brush 의 `MODE_DRAG` 만 해당       |
| `RechartsChart.tsx` 축 `hide` + `domain` 명시 | 눈금·domain 은 우리 scene 이 정하고 Recharts 는 그리기만                                                      | —                                  |

결론: 시간축은 **`linearScale` 을 epoch 위에 얹고 눈금만 시간 규칙으로** 바꾸면 되고, brush 는 **창 트랙의 상태 모델을 2-thumb 으로** 넓히는 일이다. 새 스케일 종류나 새 UI 부품이 아니다.

## 1. d3-time — 시간 간격의 대수

### 1.1 interval 원시 (`interval.js` `timeInterval(floori, offseti, count, field)`)

간격 하나는 두 함수로 정의된다 — `floor` (그 단위의 시작으로 내림) 와 `offset` (n 단위 이동). 나머지는 전부 파생:

| 파생              | 정의                                                                                                                       | 우리가 쓰는 곳                   |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| `ceil(d)`         | `floor(d − 1ms)` → `offset(+1)` → `floor` (경계값이면 그대로)                                                              | nice domain 상단                 |
| `range(a,b,step)` | `ceil(a)` 부터 `offset(step)` + `floor` 반복, `b` **미포함**; 진행 안 되면 중단 (Invalid Date 방어)                        | 눈금 생성                        |
| `count(a,b)`      | `floor` 후 차이 ÷ 지속시간 (로컬은 tz offset 차 보정)                                                                      | `every` 의 위상                  |
| `every(k)`        | `filter(d => field(d) % k === 0)` — field 가 있으면 달력 필드 (일=`getDate()−1`, 월=`getMonth()`), 없으면 epoch 기준 count | 5분 · 3시간 · 2일 같은 배수 간격 |

**패턴**: 배수 간격 (`every`) 은 "epoch 로부터 k 번째" 가 아니라 **달력 필드의 k 배수** (예: 3시간 = 0·3·6·…시) — 그래서 눈금이 자정·월초 같은 사람이 읽는 경계에 붙는다. 이 한 줄이 시간축 눈금이 "예쁜" 이유이고 우리가 옮겨야 할 핵심 규칙이다.

### 1.2 눈금 간격 선택 (`ticks.js` `tickInterval(start, stop, count)`)

18 단 표 (단위 · 배수 · 지속시간 ms):

```
second 1·5·15·30 | minute 1·5·15·30 | hour 1·3·6·12 | day 1·2 | week 1 | month 1·3 | year 1
```

규칙:

1. `target = |stop − start| / count`
2. 표를 지속시간으로 **bisect** (`right`) → 이웃 두 단 `i−1`, `i` 중 **비율이 더 가까운 쪽** (`target / step[i−1] < step[i] / target` 이면 `i−1`). 차이가 아니라 비율 — 로그 눈으로 가까운 것.
3. 표 밖 위 (`i === length`) → `year.every(tickStep(start/년, stop/년, count))` — 연 단위는 다시 1·2·5 규칙.
4. 표 밖 아래 (`i === 0`) → `millisecond.every(max(tickStep, 1))`.
5. `ticks()` 는 `interval.range(start, stop + 1)` — **stop 포함**.

지속시간 상수는 근사 (`month = 30일`, `year = 365일`, `duration.js`) — 선택에만 쓰고 실제 위치는 달력 `floor/offset` 이 정하므로 오차가 축적되지 않는다.

### 1.3 nice (`d3-scale/nice.js`)

domain `[x0, x1]` → `[interval.floor(x0), interval.ceil(x1)]`. interval 은 1.2 로 고른 것. 우리 `niceTicks` 가 값 축에서 하는 것과 같은 자리.

### 1.4 로컬 vs UTC

d3 는 두 벌 (`timeX` / `utcX`) 을 만든다. 로컬 `day.count` 는 DST 로 23·25 시간짜리 날을 tz offset 차로 보정한다. `unixDay` 는 `field = floor(epoch/일)` 로 epoch 기준 배수 (utcTicks 가 day 에 이걸 쓴다 — 달력 일이 아니라 1970-01-01 기준 2일 배수).

**우리 판정**: `parseIsoStrict` 가 이미 UTC 로 정규화하므로 **UTC 한 벌만** 옮긴다. 로컬 시간대는 publish 열람자마다 결과가 달라져 (Skia = 저작 기기, Preview = 같은 기기라 parity 는 통과하지만 publish 는 다른 기기) 두 leg 대칭의 정의 자체가 깨진다 — 메모리 `feedback-parity-same-number-different-meaning` 의 시간판. DST 보정 코드 전부 불요.

## 2. d3-scale time — 스케일과 다단 형식

### 2.1 스케일 (`time.js` `calendar`)

`continuous` (선형) 위에 `domain` 입출력만 `Date ↔ number` 변환. **스케일 계산은 선형과 동일** — 우리 `linearScale(epochMin, epochMax)` 그대로.

### 2.2 다단 눈금 형식 (`time.js` `tickFormat`)

눈금마다 **"가장 세밀한, 0 이 아닌 단위"** 로 형식을 고른다:

```
second(d) < d → ".%L"  (밀리초)
minute(d) < d → ":%S"
hour(d)   < d → "%I:%M"
day(d)    < d → "%I %p"
month(d)  < d → week(d) < d ? "%a %d" : "%b %d"
year(d)   < d → "%B"
else          → "%Y"
```

즉 하루 경계 눈금은 날짜로, 그 사이 눈금은 시각으로 — 한 축에 두 형식이 섞이는 것이 의도다 (자정 눈금이 "Mar 05", 그 다음이 "06 AM").

**우리 판정 (2026-09-12 정정)**: 처음엔 `Intl.DateTimeFormat` 옵션 표로 치환하려 했으나 §2.3 의 이유로 **d3-time-format 지시자 부분집합을 직접 이식**한다. 다단 규칙 자체 (가장 세밀한 변한 단위) 는 그대로 채택.

### 2.3 d3-time-format — 지시자 형식·파싱 (같이 가져온다)

**왜 Intl 이 아닌가** (셋 다 실측 근거):

1. **D2 참조가 이 어법이다.** RSC 는 Vega 를 거쳐 d3-time-format 지시자를 쓰고, 축 `granularity` 마다 (secondary, primary) **2단 라벨 표**를 둔다 (`vega-spec-builder/src/axis/axisLabelUtils.ts:51-65`):

   | granularity | secondary (눈금마다) | primary (경계마다) | tickCount           |
   | ----------- | -------------------- | ------------------ | ------------------- |
   | second      | `:%S`                | `%-I:%M %p`        | second              |
   | minute      | `%-I:%M %p`          | `%b %-d`           | minute              |
   | hour        | `%-I %p`             | `%b %-d`           | hour                |
   | day · week  | `%-d`                | `%b`               | day · week          |
   | month       | `%b`                 | `%Y`               | month               |
   | quarter     | `Q%q`                | `%Y`               | month × 3           |
   | year        | `%Y`                 | —                  | year                |

   d3-scale 의 "한 줄 다단" 과 RSC 의 "2단 (작은 단위 눈금 + 큰 단위 경계)" 는 같은 규칙의 두 표현이다 — RSC 쪽이 축 아래 두 줄로 나와 더 읽기 쉽다. **RSC 표를 채택**하고 지시자 이식으로 그대로 재현한다.
2. **ICU 의존이 두 leg 밖으로 샌다.** `Intl.DateTimeFormat` 결과는 ICU 판에 따라 바뀐다 (ICU 72+ 는 `"10 AM"` 의 공백이 U+202F narrow NBSP) — Builder/Preview 는 같은 Chrome 이라 parity 는 통과하지만 **publish 열람 브라우저 · Node 스냅샷** 이 다른 문자열을 낸다. 숫자 (`TICK_FORMAT` en-US, 소수 2자리) 는 ICU 간 안정하지만 날짜·시각은 아니다. 지시자 이식은 문자열이 코드에서 결정된다.
3. **파싱이 필요하다.** `parseIsoStrict` 는 ISO 만 받는다. 사용자 데이터는 `2026/03/05` · `Mar 5, 2026` · `20260305` · epoch 초가 흔하고, d3 `timeParse("%Y/%m/%d")` 처럼 **같은 지시자로 입력 형식을 선언**하는 것이 가장 작은 UI 다 (prop 하나 `dimensionFormat`). Intl 에는 파서가 없다.

**구조 (`locale.js` `formatLocale`)** — 로케일 객체 하나 (`dateTime/date/time/periods/days/shortDays/months/shortMonths`) 로 format 표와 parse 표를 같이 만든다:

- `newFormat(specifier)`: `%` 다음 한 글자를 표에서 찾아 치환, 그 앞에 패딩 수정자 `-`(없음) `_`(공백) `0`(0) 하나 허용 (`pads`), `%e` 만 기본 공백 패딩. 나머지 문자는 리터럴. 재귀 지시자 `%c %x %X` 는 로케일 문자열로 다시 `newFormat`.
- `newParse(specifier)`: 지시자마다 정규식 (`numberRe = /^\s*\d+/` — 폭 제한 없음, 다음 지시자 무시) 으로 필드를 모아 `{y,m,d,H,M,S,L,p,Z,q,V,W,U,w,u,Q,s}` 에 쌓고, 끝에서 한 번에 Date 로: `p` 로 12시간 보정, `q` → 월, `V/W/U` 주 번호 → 일, `Q/s` 는 epoch 직행, **utcParse 는 `Z` 없으면 0** 으로. 남은 문자열이 있으면 `null` (전체 일치 강제).
- `pad(value, fill, width)`: 부호 분리 후 왼쪽 채움.

**이식 범위 (부분집합 — 전량 697줄을 옮기지 않는다)**:

| 채택 지시자                                                 | 이유                                                       |
| ----------------------------------------------------------- | ---------------------------------------------------------- |
| `%Y %y %m %d %e %H %I %M %S %L %p %a %A %b %B %j %q %Z %%`  | RSC 표 + ISO 왕복 + 분기 + 일련일. `%-` `%_` `%0` 수정자 |
| parse: 위 전부 + `%Q %s` (epoch ms/s)                       | 사용자 데이터 형태 4종 커버                                |
| 로케일: `en-US` 기본 + `ko-KR` 표 (요일·월·오전/오후)       | 우리 i18n 2 언어; 축 라벨 로케일은 `valueLocale` 재사용    |
| 기각: `%U %W %V %g %G %u %w %f %c %x %X`                    | 주 번호·ISO 주 연도·마이크로초·재귀 지시자 — 수요 없음     |

UTC 벌만 (§1.4 와 같은 이유) — `utcFormats` / `utcParse` 경로만 옮기고 `localDate/utcDate` 의 0~99년 보정 (`newDate` — 두 자리 연도를 1900 대로 안 보내려는 `setFullYear`) 은 그대로 가져온다 (`%y` 파싱: `y < 68 ? 2000+ : 1900+`, `locale.js` `parseYear`).

## 3. d3-brush — 범위 선택의 상태 모델

### 3.1 상태 (`brush.js`)

- `extent` `[[x0,y0],[x1,y1]]` — 허용 영역 (px). `selection` — 현재 선택 (px) 또는 `null`.
- **selection 은 px 로 저장**된다. 스케일을 모르므로 크기가 바뀌면 사용자가 다시 잡아야 한다 (`brush.move` 로 외부에서 재설정하는 것이 관례).
- `empty(selection)` (폭 0) → `null` 로 정규화 (`ended`).

**우리 판정 (핵심 차이)**: 우리는 **데이터 좌표 (창 시작·끝 인덱스 또는 epoch) 로 저장**하고 px 는 scene 이 파생한다. 이미 창 트랙이 `start` 인덱스를 뷰 상태로 들고 있으니 그 형태를 유지. d3 의 px 저장은 스케일 무지에서 온 제약이지 장점이 아니다.

### 3.2 모드 4 (`started`)

| 모드          | 진입                   | 이동 규칙 (`move`)                                             | 우리 대응                             |
| ------------- | ---------------------- | -------------------------------------------------------------- | ------------------------------------- |
| `MODE_HANDLE` | 손잡이 (`w`/`e`) 잡음  | 한쪽 끝만 `dx` 만큼, extent 로 clamp                           | RAC range Slider 의 thumb 하나        |
| `MODE_DRAG`   | 선택 영역 본체 잡음    | 양끝 같이 `dx`, `dx` 를 `[W−w0, E−e0]` 로 clamp → 창 길이 보존 | 지금 창 트랙 (thumb 1) 이 정확히 이것 |
| `MODE_CENTER` | alt + 손잡이           | 양끝이 중심 대칭으로 `∓dx`                                     | 채택 않음                             |
| `MODE_SPACE`  | 드래그 중 space        | handle → drag 로 전환 (창 길이 고정한 채 이동)                 | 채택 않음                             |
| overlay 신규  | 빈 곳 클릭 (또는 meta) | `[p, p]` 에서 시작해 handle 모드                               | 채택 않음 (창은 항상 존재)            |

### 3.3 불변식 (옮길 것)

1. **뒤집힘 정규화**: `e1 < w1` 이면 두 끝을 swap 하고 `signX *= −1` (손잡이 정체가 바뀜). RAC range Slider 는 thumb 교차를 막으므로 우리는 "왼쪽 thumb ≤ 오른쪽 thumb" 를 Slider 가 보장 — 정규화 불요.
2. **clamp 는 이동량에**: `dx = max(W − w0, min(E − e0, dx))` — 끝값이 아니라 `dx` 를 자르면 창 길이가 보존된다. 우리 `0 … n − fitEff` 가 같은 식.
3. **shift 축 잠금** (2D 만) · **`filter`**: 우클릭·ctrl 클릭 무시. 1D 트랙엔 해당 없음.
4. **`handleSize = 6`** — 손잡이 hit 영역은 시각 폭과 별개로 6px. RAC thumb 이 담당.
5. **키보드 없음** — d3-brush 는 포인터 전용. RAC Slider (화살표 · Home/End · PageUp/Down) 가 상위.

### 3.4 d3 에 없는 것 — 우리가 정해야 할 것

- **최소 창**: d3 는 extent 만 있고 최소 폭이 없다 (0 이면 null). 우리는 ADR-211 예산 때문에 **최소 창 = fitEff** 가 필요하다 — 창을 fitEff 밑으로 못 줄이면 예산이 항상 지켜지고, 넓히면 그 창 안에서 극값 재추출. 이 결정이 ADR 의 핵심이고 d3 는 답을 주지 않는다.
- **미니 차트**: d3-brush 에도 없다 (Recharts `Brush` 의 장식). 채택 않음 — Skia 에 같은 걸 그려야 대칭.

## 4. 우리 모듈로의 사상 (ADR Phase 0 표의 초안)

| 새로 쓸 것                                                             | 크기 (d3 소스 기준 추정)                              | 두는 곳                         | 검증                                                                                 |
| ---------------------------------------------------------------------- | ----------------------------------------------------- | ------------------------------- | ------------------------------------------------------------------------------------ |
| UTC interval 7종 (ms·s·min·h·day·week·month·year) `floor/offset/field` | `interval.js` 60줄 + 단위 8 파일 → **~90줄** (UTC 만) | `specs/chart/timeIntervals.ts`  | d3-time 을 **devDependency 로 두고 테스트에서만 대조** (differential oracle, 번들 0) |
| 18 단 표 + `tickInterval` + `range` 포함 stop                          | `ticks.js` 58줄 → **~50줄**                           | `specs/chart/timeTicks.ts`      | 같은 오라클 + 손계산 표 (1시간·1일·1달·3년 span)                                     |
| nice (floor/ceil)                                                      | 5줄                                                   | `niceTicks` 옆 `niceTime`       | 오라클                                                                               |
| 지시자 format + parse 부분집합 (§2.3) + en/ko 로케일 표 + RSC 2단 표   | `locale.js` 697줄 중 채택 지시자만 → **~180줄**       | `specs/chart/timeFormat.ts`     | d3-time-format devDependency 오라클 (채택 지시자 × 날짜 100 케이스 왕복 format∘parse = id) |
| 시간 스케일                                                            | 0 (`linearScale` 재사용)                              | —                               | 기존                                                                                 |
| 창 상태 `[start, end]`                                                 | windowTrack 확장                                      | `windowTrack.tsx` + `budget.ts` | 최소 창 = fitEff 불변식 테스트                                                       |

번들: 위 합계 ~350줄은 Skia 가 읽으므로 **Builder initial** 순증 — ADR-211 이 7 KiB 한도를 썼던 자리. gzip 2 KiB 안팎으로 추정하되 **실측 전 수치 확정 금지** (measurement-validity).

## 5. 채택 / 기각 요약

| 항목                                                 | 판정          | 이유                                                         |
| ---------------------------------------------------- | ------------- | ------------------------------------------------------------ |
| interval 대수 (floor/offset → ceil/range/every)      | 채택          | 눈금이 달력 경계에 붙는 유일한 방법                          |
| 18 단 표 + 비율 bisect                               | 채택          | count 에서 단위를 고르는 규칙, 손계산 가능                   |
| 연 단위 → 1·2·5 재귀                                 | 채택          | 이미 있는 `tickIncrement` 재사용                             |
| 로컬 시간대 벌 · DST 보정                            | 기각          | UTC 단일 (parity 정의 유지)                                  |
| 다단 형식 (가장 세밀한 변한 단위) → RSC 2단 표      | 채택          | D2 참조와 같은 어법                                          |
| d3-time-format 지시자 format/parse 부분집합          | 채택          | ICU 비의존 문자열 · 파서 · RSC/Vega 와 같은 지시자 (§2.3)    |
| `Intl.DateTimeFormat` 로 축 라벨                     | 기각          | ICU 판마다 문자열이 달라 publish·스냅샷이 흔들림 (U+202F)    |
| brush px 저장                                        | 기각          | 데이터 좌표 저장 (우리 창 트랙 형태 유지)                    |
| MODE_DRAG · MODE_HANDLE · dx clamp                   | 채택          | range Slider 2 thumb + 본체 드래그 = 창 이동                 |
| MODE_CENTER · MODE_SPACE · overlay 신규 · shift 잠금 | 기각          | 1D 트랙 · 창 상시 존재 · RAC 키보드가 대체                   |
| 최소 창 = fitEff                                     | **우리 결정** | d3 에 없음 — ADR-211 예산 유지의 조건                        |
| 미니 차트                                            | 기각          | Skia 대칭 비용                                               |
| d3 devDependency 오라클                              | 채택          | `project-engine-css-parity-differential-oracle` 과 같은 패턴 |

## 6. ADR 로 넘길 결정 (여기서 정하지 않음)

1. 시간축 범위 — line/area(/scatter) 한정, bar 는 band 유지 (Recharts · RSC 둘 다 bar 는 band).
2. opt-in prop 이름 (RSC `scaleType: "time"` 참조) — 기존 문서 byte-동일 게이트 유지 조건.
3. ADR-211 예산 모델의 시간판 — 버킷 = `tickInterval` 로 고른 단위의 배수인가, px 폭인가.
4. 창 상태 `[start, end]` 로 확장 시 Canvas 표시 (항상 기본 창) 와 parity 캡처 규약.
5. 번들 상한 재승인 (215 상한 만료 2026-10-10).
