# ADR-219: Border 기하 채널 — per-corner radius · per-side width

## Status

Accepted — 2026-09-14 (사용자 `/execute-adr 219` 착수 · P0 G0 spike 3 케이스 diffRatio 0 — [evidence/219-p0-spike.md](evidence/219-p0-spike.md)). 판독 이력: **round 1 (codex, HIGH 3 · MEDIUM 2) · round 2 (HIGH 2 잔존 — h1 배치 순서 · h6 companion 재주입) 반영 2026-09-14** — h1 저장은 사후 정규화가 아니라 **배치 편집 연산** (effective·base 입력 · 고정 우선순위 shorthand → longhand · 한 번 적용) · h6 companion 폭 판정을 shorthand ∨ longhand 로 · h2 border 는 ADR-154 eligible 밖이라 **전역 유지** (responsive 전제 삭제) · h3 코너 반경 축소를 CSS Backgrounds §4.5 비례 규칙으로 (`clampCornerRadii` 의 `min(w,h)/2` 는 CSS 와 다름 — 수리) + 코너 호 소유권 · m4 비균일 + double/groove/ridge/inset/outset 은 미지원 (패널 차단 · import 문서는 기록된 비대칭) · m5 성능 gate 에 불리 동작·환경 고정 ([reviews/219.md](reviews/219.md)). (Styles 패널 업그레이드 시안 `docs/design/panel-ui` 02 Style 탭 ③ 코너 2×2 · ④ 변 선택 세그먼트의 선행 결정. 시안 코드 반영 21 단계까지 전부 완료 (`88e93d238`) 뒤 착수 — task-state 중단 기준 "Skia 채널이 없는 시안 항목을 패널에서 먼저 열면 중단 (ADR 선행)" 이 이 ADR 이다)

## Context

빌더의 테두리는 **네 변 같은 폭 · 네 코너 같은 반경** 하나씩이다. Styles 패널 Border 절은 `borderWidth` · `borderRadius` 를 숫자 하나로 쓰고 (`panels/styles/sections/BorderSection.tsx:111-112, 138-139, 164-165`), Skia 는 `convertToStrokeStyle` 이 `borderWidth`/`borderColor` 만 읽어 stroke 하나를 돌려준다 (`workspace/canvas/styleConversion/styleConverter.ts:670-683`). 시안은 코너 2×2 (TL/TR/BL/BR 항상 보이는 4칸) 와 변 선택 세그먼트 (전체/좌/우/상/하) 를 그렸고, 둘 다 **Skia 에 채널이 없어** 패널을 먼저 열 수 없었다.

**코드 사실 (2026-09-14 main `88e93d238`, 상세 표는 breakdown §2.1)** — 채널은 생각보다 많이 있다. 없는 것은 "패널 → 저장 → Skia 변환" 의 앞 두 칸과 변별 stroke 렌더러뿐이다:

- **저장 키 공간**: `props.style` 은 CSS 키 그대로다. DOM leg 는 override passthrough 라 (`packages/shared/src/catalog/resolvers/resolveMergedStyle.ts:13` `toReactStyle` — 사용자 구체값을 React inline style 로 그대로) longhand 8개 (`borderTopLeftRadius`… · `borderTopWidth`…) 가 **이미 Preview/Publish 에서 그려진다**. 레이아웃 엔진 입력도 longhand 를 읽는다 — `layout/engines/utils.ts:739-770 parseBorder` (longhand ?? `borderWidth` 다중값 ?? `border` 단축) · `cssResolver.ts:88-94` 기본값 · `paddingUtils.ts:178-193`. 무효화 레지스트리도 longhand 를 분류해 두었다 (`presentation/invalidation/editorMutationEffectRegistry.ts:79-83, 186-194, 255-259, 370-374`). 즉 **DOM · 레이아웃 · 무효화는 longhand 준비 완료**, 저장은 `SHORTHAND_TO_LONGHAND` 가 gap/padding/margin 만 분배하고 (`stores/utils/responsiveWriteRouting.ts:11-15`) border 는 손대지 않는다.
- **Skia 반경**: `convertBorderRadius` 가 `borderRadius: "8px 4px 2px 6px"` 다중값을 `[tl,tr,br,bl]` 로 파싱하고 (`styleConverter.ts:1003-1031`) `buildBoxNodeData.ts:117, 249, 316` 이 그대로 `box.borderRadius: number | [4]` 에 싣는다 (`skia/nodeRendererTypes.ts:45`). 채우기·stroke·outline 렌더러는 배열을 `createRoundRectPath` 로 그린다 (`nodeRendererBorders.ts:40-70, 496-515, 596-612` · `nodeRendererClip.ts:33`). 단 그 배열의 **축소 규칙이 CSS 와 다르다** — `clampCornerRadii` (`nodeRendererClip.ts:17-41`) 는 코너마다 `min(w,h)/2` 로 자르는데 CSS ([Backgrounds 3 §4.5](https://www.w3.org/TR/css-backgrounds-3/#corner-overlap)) 는 변마다 인접 반경 합으로 비례 계수를 구해 전체에 곱한다 (100×100 `[80,0,0,0]`: Skia 50 · CSS 80). 균일 반경에서는 두 규칙이 같은 값이라 지금까지 드러나지 않았다. **첫 값만 읽는 곳 4** — 바깥 그림자 `:332-334` · 안쪽 그림자 `:405-407` · AI 효과 bounds `renderCommands.ts:2625-2628` · clip-path inset round `nodeRendererClip.ts:95-105`. 반경 longhand 는 `CSSStyle` 타입에 없다 (`styleConverter.ts:46-52` — 폭 longhand 4개만 타입에 있고 읽는 곳 0).
- **Skia 변별 테두리**: `partial_border` 프리미티브가 있다 — `sides {top,right,bottom,left}: boolean` + 폭 하나 + 대시 + 코너 4 반경 (`nodeRendererTypes.ts:15-21` · `nodeRendererShapes.ts:93-164 renderPartialBorder` · `renderCommands.ts:2391-2392`). 생산자는 잔존 spec 의 `sides` shape 하나 (`specShapeConverter.ts:624-650`). 사용자 style 에서는 만들어지지 않는다. 코너 호는 **인접 두 변이 각각 전체를 그린다** (`:122-131` top 이 TR 호 전체, `:143-146` right 도) — 불투명 색에서는 안 보이지만 반투명 stroke 는 코너가 두 번 칠해진다.
- **패널 · 기준값**: 카탈로그 base 는 단일값이다 (`packages/shared/src/types/composition-document.types.ts:302-303 ComponentRuleSize.borderRadius/borderWidth` · `resolveEditContract.ts:125-133 UNIVERSAL_STYLE_CONTRACTS` kind number). reset 기준선 (`panels/styles/hooks/useResetStyles.ts:51-52, 225-231`) · 절 prop 목록 (`styleSectionProps.ts:10-11, 27-28`) · 숫자 코어스 (`responsiveWriteRouting.ts:27-44 NUMERIC_COERCE_STYLE_PROPS`) 전부 두 키만 안다.
- **죽은 표면**: `overlay/hooks/useBorderRadiusDrag.ts:65-70, 190-205` 가 코너 longhand 를 쓰지만 소비처 0 (grep) — 이 훅이 쓴 값은 Skia 가 무시했을 것이다.
- **범위 밖 기존 비대칭 (본 ADR 이 만들지 않은 것)**: 자식 clip 은 반경 없는 `clipRect` 다 (`renderCommands.ts:1597-1605`, 균일 반경도 안 깎는다) — `overflow: hidden` + 반경의 DOM/Skia 차이는 별도 항목.

**Responsive 계약 (round 1 h2)**: border 축은 ADR-154 eligible 집합 밖이다 (`packages/shared/src/types/responsive.types.ts:213-223` = Layout·Transform 만) — `shouldWriteBreakpointOverride` 가 base 로 보내고 (`responsiveWriteRouting.ts:140-150`) DOM emit 도 같은 필터로 거른다 (`packages/shared/src/utils/responsiveCss.ts:113-117`, `responsiveCss.test.ts:19-28, 55-64`). 본 ADR 은 이 계약을 **그대로 둔다** — 코너/변은 전역 속성이며 breakpoint 별 값은 범위 밖 (154 eligibility·picker·resolve·emit 4곳을 함께 여는 별도 개정).

**SSOT 3-domain**: 본 ADR 은 **D3** (사용자 override 층의 시각 채널) 다. 키는 CSS longhand 그대로라 **D2 신규 prop 0** (RSP 미규정 prop 도입 없음), **D1 무관** (DOM 구조·ARIA 변경 없음). 카탈로그 base (`ComponentRuleSize`) 는 단일값 그대로 두고 비균일은 **override 전용** — theme rule 이 코너별 값을 갖는 일은 없다 (Generator 확장 0: 자식 selector/variant emit 불필요, CSSGenerator 무변경).

**BC**: 새 longhand 미설정 = 현행이라 **기존 문서 영향 0% · 재직렬화 0 파일**. 구버전 빌더가 새 문서를 열면 longhand 를 무시한다 (데이터 손실 없음 — 편집 연산 §Decision 이 비균일에서 shorthand 를 지우므로 구버전은 반경 0/폭 0 으로 보일 수 있다: rollback 경계는 breakdown §2.5).

**Hard Constraints**:

1. **HC1 기존 문서 동일 — 균일 반경 한정** — longhand 없고 `borderRadius` 가 단일값인 문서의 Skia 렌더 커맨드 스트림 · 픽셀이 지금과 동일 (ADR-198 parity gate smoke + `renderCommandStream` 스냅샷 무변경). **경계**: 다중값 shorthand (`"80px 0 0 0"`) 문서는 CSS 축소 규칙으로 **수리**되어 픽셀이 바뀐다 — 오류 수정이며 HC1 밖, CHANGELOG 에 기록.
2. **HC2 D3 대칭** — 비균일 반경 (비례 축소 발생 케이스 포함) · 변 선택 (반투명 색 포함) · 폭 임의 4값 10 케이스에서 Skia 와 Preview 픽셀 parity 가 ADR-198 게이트 임계 (region 0.98) 안. dashed/dotted 임의 폭의 코너 호는 근사 (0.95). **지원 범위 밖**: 비균일 폭 + double/groove/ridge/inset/outset — 패널이 만들지 않고 (변 세그먼트 비활성), import/수동 문서는 Skia 가 solid 로 그리며 배지로 알린다. 이 조합은 **기록된 비대칭** (G2 케이스 11 로 측정만).
3. **HC3 저장 불변식 · 편집 보존** — `props.style` 에서 `borderRadius` 와 코너 longhand, `borderWidth` 와 변 longhand 가 **동시에 존재하지 않는다** (균일 = shorthand 하나, 비균일 = longhand 4, 부분 longhand 0). 그리고 편집 의도가 보존된다 — shorthand 쓰기는 기존 longhand 를 덮고, 코너 하나 쓰기는 미편집 코너를 **편집 전 유효값 (카탈로그 base 포함)** 으로 채우며, 배치는 축별 고정 우선순위 (shorthand → longhand) 로 한 번 적용해 키 순서와 무관하다 (round 1 h1 · round 2 h1 반례가 시나리오). 후속 색/스타일 편집의 companion 이 이 불변식을 깨지 않는다 (round 2 h6).
4. **HC4 성능** — 균일 노드의 rrect 경로 무변경 (분기 추가 비용은 `Array.isArray` 하나). 비균일 노드만 path 생성. 측정은 **불리 동작** (반경·폭 슬라이더 드래그 · 비균일 요소 리사이즈 — path 가 매 프레임 재생성) 을 같은 fixture (600 + 비균일 100) · 같은 환경 (기기 · DPR 2 · 전경 탭 · throttle 0 · 힙 Δ 병기) 에서 before/after 총 프레임 비용으로 — p95 Δ ≤ 1 ms.
5. **HC5 패널 규격** — 코너 2×2 · 변 세그먼트는 컨트롤 28/32 두 티어 · 행 템플릿 `1fr 1fr 28px` · `--text-2xs` 10 mono (9px 금지) · 새 라벨 i18n ko/en · 쓰기는 `updateStyle/updateStyleImmediate/updateStylePreview` 만 (task-state guard 그대로).
6. **HC6 번들** — Builder initial 순증 ≤ 2 KiB gzip, 절대 상한 218 승인값 (1,281,643 / 666,309, 만료 2026-10-13) 안. Preview 순증 0 (DOM leg 변경 없음).

## Alternatives Considered

### 대안 A: CSS longhand 저장 + 상호 배타 편집 연산 + 판독 helper 하나

- 설명: 비균일은 CSS longhand 8개 (`borderTopLeftRadius`… · `borderTopWidth`…) 로 저장한다. store 가 쓰기마다 **편집 연산** — 편집 전 유효 4값 (longhand ?? shorthand ?? 카탈로그 base) 을 입력받아, shorthand 쓰기는 longhand 를 지우고 덮으며, longhand 하나 쓰기는 나머지 칸을 유효값으로 채운 뒤 4값이 같으면 shorthand 하나로 접고 다르면 4 longhand 로 펼친다 (HC3, 배치 순서 독립). 읽기는 `resolveBorderGeometry(style, base) → { radii[4], widths[4] }` helper 하나 (longhand ?? shorthand 다중값 ?? shorthand 단일 ?? base) 를 Skia converter · 패널 · Modified · reset 기준선이 공유하고, 레이아웃 `parseBorder` 는 이미 같은 우선순위라 동치 테스트만 둔다. Skia: 반경은 기존 배열 경로에 CSS §4.5 비례 축소 (`clampCornerRadii` 교체) + 첫 값만 읽던 4곳 확장. 폭은 `box.strokeWidths?: [4]` 3단 — ① 변 마스크 (각 변이 w 또는 0, 시안 세그먼트의 쓰기 형태, style solid/dashed/dotted) → `partial_border` 재사용 (코너 호 소유권 재작성 — 호는 한 번만) ② 임의 4값 + solid → 바깥 반경 path − 안쪽 반경 path (안쪽 rx = r − 인접 세로변 폭, ry = r − 인접 가로변 폭 — CSS 와 같은 기하) even-odd 채우기 ③ 임의 4값 + dashed/dotted → 변마다 자기 폭의 stroke path (코너 호 이등분, 근사). 비균일 + double/groove/ridge/inset/outset 은 미지원.
- 근거: Figma/Pencil 은 코너 4 · 변 4 를 독립 채널로 두고 (Pencil `strokeSides`), Chrome 은 비균일 폭 solid 테두리를 바깥/안쪽 rrect 차로 칠한다 (Skia `drawDRRect`, Blink `BoxBorderPainter`) — ②가 그 기하 그대로다. ADR-909 (store longhand 정책 ↔ consumer 정규화) 와 같은 방향이되 padding 처럼 항상 분배하지 않는 이유는 base 키가 단일값이기 때문 (대안 C).
- 위험: 기술(M — ②③ 기하, 코너 호 분할 근사) / 성능(L — 비균일만 path, 균일 무변경) / 유지보수(M — 판독이 helper 하나로 수렴하지 않으면 두 형태 분기가 소비처마다 늘어난다) / 마이그레이션(L — 기존 문서 0%, 구버전 균일 폴백)

### 대안 B: shorthand 다중값 문자열 단일 키

- 설명: `borderRadius: "8px 4px 2px 6px"` · `borderWidth: "1px 0 1px 0"` 로 키 하나에 담는다. Skia 반경은 이미 파싱하고 (`styleConverter.ts:1003`) 레이아웃도 `parseShorthand` 로 다중값을 읽는다 (`utils.ts:756`). DOM 네이티브.
- 근거: CSS 자체가 이 표기를 허용하고 변경 파일이 가장 적다.
- 위험: 기술(L) / 성능(L) / 유지보수(**H** — 숫자 코어스 `NUMERIC_COERCE_STYLE_PROPS` 가 `parseFloat("8px 4px …") = 8` 로 **저장 시점에 다중값을 파괴** (`responsiveWriteRouting.ts:27-50`); 숫자로 다루는 소비처 8곳 (`BorderSection.tsx:111-112 resolveCssLengthPx` · `useResetStyles.ts:225-231` · `resolveEditContract.ts:125-133 kind number` · `useBorderRadiusDrag.ts:49-58` 첫 값 · `interpolators.ts:78-82` 보간 · `convertToStrokeStyle` `parseCSSSize` 첫 값 · AI bounds · minimap) 이 전부 첫 값만 읽는다; 코너/변 단위 개별 삭제·reset 불가 (키 하나 통째)) / 마이그레이션(M — ADR-909 longhand 정책과 반대 방향, 무효화 레지스트리의 longhand 분류가 죽는다)

### 대안 C: ADR-909 완전 확장 — 항상 longhand 4 로 분배 (padding 과 동일)

- 설명: `SHORTHAND_TO_LONGHAND` 에 `borderRadius → 코너 4` · `borderWidth → 변 4` 를 추가해 균일값도 항상 longhand 4개로 저장한다. 읽기는 대안 A 와 같은 helper.
- 근거: padding/margin/gap 과 저장 형태가 같아져 "shorthand 는 저장에 없다" 는 단일 규칙이 된다.
- 위험: 기술(L) / 성능(L) / 유지보수(**H** — 카탈로그 base 는 `ComponentRuleSize.borderRadius/borderWidth` 단일 키라 override 키 4 ↔ base 키 1 대조가 dirty · reset · edit contract · Modified · theme base 비교 전부에서 재작성 (padding 은 base 가 없어 이 문제가 없었다); 기존 문서의 shorthand 는 읽기 폴백으로 영구 잔존하므로 "두 형태 공존" 은 A 와 같은데 정규화 이득만 사라진다) / 마이그레이션(M — 모든 프로젝트의 Modified 가 반경 1행 → 4행, 기존 문서와 새 문서의 저장 형태가 갈린다)

### 대안 D: 비 CSS 구조 객체 채널 (`style.borderRadius: { tl, tr, br, bl }`)

- 설명: 코너/변을 객체 하나로 저장하고 DOM/Skia 어댑터가 각각 CSS/경로로 변환한다.
- 위험: 기술(M) / 성능(L) / 유지보수(**H** — `props.style` 은 CSS 키 공간이라 DOM `toReactStyle` passthrough 가 깨지고 publish/export 계약이 바뀐다; D3 "수동 표현이 SSOT 파생 아님" 위반) / 마이그레이션(**H** — 기존 문서 `borderRadius: 8` 과 타입 충돌, 구버전 호환 0)

### Risk Threshold Check

| 대안 | HIGH+                       | 판정                                                        |
| ---- | --------------------------- | ----------------------------------------------------------- |
| A    | 0                           | 채택 후보 — M 2 (기하 근사 · 판독 수렴) 는 Gate 로 관리     |
| B    | 유지보수 H                  | 저장 시점 값 파괴 + 숫자 소비처 8곳 재작성 — 기각           |
| C    | 유지보수 H                  | base 단일 ↔ override 4 대조 재작성, 정규화 이득 없음 — 기각 |
| D    | 유지보수 H · 마이그레이션 H | CSS 키 공간 이탈 — 기각                                     |

루프 1회: A 에 HIGH 0 이라 종료.

## Decision

**대안 A 채택.** 저장은 CSS longhand, 균일/비균일 상호 배타 — 사후 정규화가 아니라 **배치 편집 연산** (`applyBorderGeometryBatch(style, entries, effective)`: border 축 키는 항목별이 아니라 배치 하나로 — 편집 전 유효 4값에서 시작해 shorthand → longhand 고정 우선순위로 한 번 적용 (`{TL:12, borderRadius:4}` 는 순서 무관 `[12,4,4,4]`), 4값 같으면 접고 다르면 4 longhand). companion 은 폭 존재를 shorthand ∨ longhand 로 판정해 변별 폭 뒤에 `borderWidth: 1` 을 다시 넣지 않는다. 판독은 helper 하나 (`resolveBorderGeometry` + CSS §4.5 `resolveCssCornerRadii` — 기존 `clampCornerRadii` 3 호출처 교체). Skia 폭은 3단 (solid 비균일 — 변 마스크 포함 — → even-odd 영역 path / dashed·dotted 비균일 → `partial_border` 코너 호 소유권 재작성 / double 계열 → 미지원·강등). P0 spike (2026-09-14, [evidence/219-p0-spike.md](evidence/219-p0-spike.md)) 가 변 마스크도 even-odd 가 정확함을 실측했다 — CSS 는 폭 0 변 쪽 코너 띠를 테이퍼하는데 폭 일정 호는 그것을 못 내고 반투명 코너를 두 번 칠한다. border 는 전역 (responsive 밖).

위험 수용 근거: 비균일 폭의 코너 기하는 solid 에서 CSS 와 같은 식 (안쪽 타원 반경 = 바깥 − 인접 변 폭) 이라 근사가 아니고, 근사가 남는 곳은 dashed/dotted 임의 4값 코너 하나뿐이다 — 시안의 쓰기 형태 (변 마스크) 는 solid 면 even-odd (정확) 이고 dashed/dotted 마스크만 코너 호 근사에 걸린다. 판독 수렴은 정적 가드 (`resolveBorderGeometry` 외에서 `style.borderTopLeftRadius` 등을 직접 읽는 파일 0) 로 지킨다.

기각 사유 — B: 저장 파이프라인이 다중값을 첫 값으로 깎는다 (`toStyleNumericValue`), 코너 단위 삭제·reset 불가. C: base 가 단일값인 채널에 항상-4 저장은 dirty/reset/contract 전면 재작성만 남기고 정규화 이득이 없다. D: `props.style` 의 CSS 키 공간을 깨고 DOM passthrough 가 무너진다.

**구현 경계**: 코너 반경은 원형 (`rx = ry`) 만 — CSS `border-radius: 8px / 4px` 타원 표기는 범위 밖 (패널이 쓰지 않고 Skia 도 파싱 안 함, 현행 유지). 변별 **색** (`borderTopColor`…) 도 범위 밖 — 시안에 없고 partial_border 도 색 하나. **비균일 폭 + double/groove/ridge/inset/outset 은 미지원** — 패널 차단, import 문서는 solid 강등 + 배지 (HC2). breakpoint 별 코너/변은 범위 밖 (ADR-154 개정). 자식 clip 반경은 기존 비대칭이라 별도.

> 구현 상세: [219-border-geometry-per-corner-radius-per-side-width-breakdown.md](design/219-border-geometry-per-corner-radius-per-side-width-breakdown.md)

## Risks

| ID | 위험 | 심각도 | 대응 |
| --- | --- | :---: | --- |
| R1 | 판독이 helper 로 수렴하지 않고 소비처가 `style.borderTopLeftRadius` 를 직접 읽어 두 형태 분기가 퍼진다 (Skia 첫 값 4곳 · 패널 · reset · Modified) | MED | `resolveBorderGeometry` 단일 진입 + 정적 가드 (helper 밖 직접 읽기 0) — G3 |
| R2 | dashed/dotted + 임의 4값 코너 호 근사가 parity 임계 밖 · 큰 비대칭 반경의 CSS 비례 축소 식 오류 | MED | G0 spike 3 (even-odd · `[80,0,0,0]` · 반투명 변 마스크) 선행 · G2 실패 시 그 조합만 균일 폭 (max) 폴백 — 시안 쓰기 형태 (①) 는 영향 0 |
| R3 | 편집 연산이 유효값 (base) 을 잘못 읽어 미편집 코너가 0 이 되거나, 배치가 항목 순서에 의존하거나, companion 이 변별 폭 뒤에 `borderWidth` 를 재주입해 불변식이 깨진다 (round 1·2 h1 · h6 반례) | MED | 배치 하나 · 고정 우선순위 · 입력에 `resolveMergedStyle(node).base` · companion `hasBorderWidth` — G3 시나리오 9 |
| R4 | 구버전 빌더가 새 문서 (longhand 만, shorthand 삭제) 를 열면 반경/폭 0 으로 보인다 | LOW | 데이터 손실은 없다 (키 보존). rollback 경계 = P2 commit (breakdown §2.5); CHANGELOG 에 명시 |
| R5 | 카탈로그 base 가 균일 반경을 갖는 컴포넌트 (Button 등) 에 코너 하나만 바꾸면 dirty 판정이 4 longhand 전부 dirty 로 나온다 | LOW | 의도된 동작 (비균일 = override 전용). reset 은 4개를 함께 지운다 — breakdown §2.4 |

잔존 HIGH 위험 없음.

## Gates

| Gate | 시점 | 통과 조건 | 실패 시 대안 |
| --- | --- | --- | --- |
| G0 spike ✅ | P0 | 3 케이스 — solid 임의 4값 + 코너 4값 even-odd path · 100×100 `[80,0,0,0]` (CSS 80 유지) · 반투명 변 마스크 (인접 두 변 on, 코너 한 번 칠함) 가 같은 크기 Preview 와 region 0.98 이상 (ADR-198 하니스) — **2026-09-14 통과**: diffRatio 0 / 0 / 0 (before 0.19 / 0.23 / 0.10), `[80,80,0,0]` 축소 0 추가 | 기하 식 재검토 후 재시도 1회, 실패 시 ③ 변별 stroke 로 통일 |
| G1 기존 동일 | P2 | 균일 반경 fixture 의 `renderCommandStream` 스냅샷 · ADR-198 smoke byte/픽셀 무변경 · specs/builder 기존 테스트 전량 PASS (다중값 shorthand 스냅샷은 CSS 값으로 갱신 — diff 를 evidence 에) | 분기 위치를 converter 밖으로 옮겨 균일 경로에서 코드 경로 0 변경 |
| G2 대칭 | P2·P5 | HC2 케이스 10 (비례 축소 1 · 반투명 1 포함) — region ≥ 0.98, dashed/dotted ③ 조합만 0.95 · 케이스 11 (변 마스크 + double, 미지원) 은 수치 기록만 | 그 조합 균일 폭 폴백 (R2) |
| G3 불변식·수렴 | P3 | 정적 테스트: (a) helper 밖 longhand 직접 읽기 0 (b) store 시나리오 9 (빈 style + shorthand · 빈 style + 코너 1 (base 8 → `[12,8,8,8]`) · `[8,4,2,6]` + shorthand 12 → 12 만 · 3 코너 순차/배치 → 접힘 · 코너 지우기 → base · shorthand 지우기 → 키 0 · 배치 `{TL:12, borderRadius:4}` 두 순서 → `[12,4,4,4]` · 변 마스크 → 전체 복귀 · 변 마스크 → 색 → 스타일 편집 뒤 companion 무주입) 뒤 shorthand·longhand 동시 존재 0 | 연산을 한 곳으로 합치고 재측정 |
| G4 성능 | P5 | 같은 fixture (600 + 비균일 100) · 같은 동작 (반경 드래그 60 스텝 · 폭 드래그 60 · 비균일 리사이즈 60) · 같은 환경 (기기 · DPR 2 · `visibilityState=visible` · throttle 0 · 힙 Δ) 에서 before/after 총 프레임 비용 p95 Δ ≤ 1 ms — measurement-validity 5-질문을 evidence 에 | path 캐시 (노드 크기·반경·폭 키) 추가 |
| G5 번들 · 규격 | P4·P5 | Builder initial 순증 ≤ 2 KiB · Preview 0 · 패널 실측 (코너 4칸 87×28 · seg 28 · 행 템플릿) | 아이콘 4개를 인라인 path 로, 세그먼트를 기존 ToggleButtonGroup 재사용 |

### Live Exercise

(Implemented 승격 시 기재)

## Consequences

### Positive

- 시안 02 ③④ 를 열 수 있다 — 코너 2×2 · 변 선택 세그먼트가 Skia 와 Preview 에서 같은 결과를 낸다.
- 이미 longhand 를 읽던 레이아웃 · DOM · 무효화 (`parseBorder` · `toReactStyle` · `editorMutationEffectRegistry`) 와 Skia 가 같은 키를 보게 되어 "레이아웃은 변별 폭을 반영하는데 그림은 균일" 이던 잠재 비대칭이 닫힌다.
- 첫 값만 읽던 그림자 · AI bounds · clip-path 4곳이 코너 4 반경을 따른다 (다중값 shorthand 문서에서도 개선).
- `partial_border` 프리미티브가 사용자 style 의 생산자를 얻는다 (잔존 spec 전용 → 공용).

### Negative

- 저장 형태가 값에 따라 갈린다 (균일 shorthand / 비균일 longhand). 판독은 helper 하나로 숨기지만 편집 연산 규칙을 store 가 계속 지켜야 한다 (G3).
- 다중값 shorthand 문서는 코너 축소가 CSS 값으로 바뀐다 (수리 — 픽셀 변경).
- Modified 절은 비균일일 때 4행이 된다 (「Border Top Left Radius · 8px」 …) — padding 과 같은 표시 (Overrides 절은 해당 없음 — 전역).
- dashed/dotted + 임의 4값 코너는 근사 (R2). 비균일 + double/groove/ridge/inset/outset 은 미지원 (기록된 비대칭). 변별 색 · 타원 반경 · breakpoint 별 값 · 자식 clip 반경은 범위 밖으로 남는다.
- 구버전 빌더는 새 문서의 비균일 테두리를 0 으로 그린다 (R4).
