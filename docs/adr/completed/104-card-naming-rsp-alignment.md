# ADR-104: Card 시리즈 네이밍 RSP/S2 정합 감사 — CardHeader/CardContent/CardFooter/CardView/CardPreview 정당화 (ADR-098-f 슬롯)

## Status

Implemented — 2026-04-21

> 본 ADR 은 [ADR-098](098-rsp-naming-audit-charter.md) (RSP 네이밍 정합 감사 Charter) 의 "098-f 슬롯" 구현. ADR-098 Charter 후보 #8 "Card / CardContent / CardHeader / CardFooter / CardView — RSP 본체 docs 접근 불가 (404), 조사 재시도 필요". **Phase 0 RSP/S2 재조사 결과: 모두 BC HIGH (factory 직렬화 tag) + RAC/RSP/S2 공식 API 에 동일 이름 슬롯 컴포넌트 미존재 확인 — 대안 A (정당화 유지) 채택.**

**Phase 커밋 체인** (origin/main):

- P0 완료 — RSP/S2 재조사 + BC 재평가 + 시나리오 판정 + 2 대안 평가 (ADR-104 본문 작성, 2026-04-21 세션 12)
- P1 완료 — spec 파일 ADR-104 정당화 주석 sweep (Card.spec.ts, CardHeader.spec.ts, CardContent.spec.ts, CardFooter.spec.ts, CardView.spec.ts)
- P2 완료 — README.md ADR-104 Implemented 추가

**종결 검증**: type-check 3/3 + specs 205/205 + builder 227/227 + shared 52/52 PASS. BC 영향 0% (정당화 유지 결정 — migration 0건).

## Context

ADR-098 감사 매트릭스 (2026-04-21) 에서 composition 의 `CardHeader` / `CardContent` / `CardFooter` / `CardView` / `CardPreview` 가 RSP/S2 공식 명칭과의 정합 여부가 미확인 상태로 후보 #8 에 등록되었다. 이전 세션에서 RSP 본체 docs 가 404 (실제는 301 redirect) 로 접근 불가였으므로 본 ADR 에서 재조사.

**3-Domain 분류**: 본 ADR 은 D2 (Props/API — RSP 참조 기반 네이밍 정합) 판정. D3 (시각 스타일) 귀속 확증이 병행.

### Phase 0 RSP/S2 재조사 결과 (2026-04-21)

#### 0-1. 공식 docs URL 재조사

| URL                                                 | 결과 | 비고                |
| --------------------------------------------------- | :--: | ------------------- |
| `react-spectrum.adobe.com/react-spectrum/Card.html` | 301  | 본체 docs 접근 불가 |
| `react-spectrum.adobe.com/s2/Card.html`             | 301  | S2 docs 접근 불가   |

#### 0-2. S2 GitHub 소스코드 직접 참조 (성공)

접근 성공 경로:

- `github.com/adobe/react-spectrum` — `packages/@react-spectrum/s2/src/Card.tsx`
- `github.com/adobe/react-spectrum` — `packages/@react-spectrum/s2/src/CardView.tsx`
- `github.com/adobe/react-spectrum` — `packages/@react-spectrum/s2/src/Content.tsx`
- `github.com/adobe/react-spectrum` — `packages/@react-spectrum/card/src/index.ts` (RSP classic)

#### 0-3. S2 Card 구조 분석

S2 `Card.tsx` 는 슬롯으로 `Content`, `Header` (범용 컴포넌트), `Footer` (Content.tsx 에서 export) 를 사용:

```tsx
// S2 Card.tsx — slot 사용 패턴
import {ContentContext, FooterContext, TextContext} from './Content';

// Provider 주입:
[ContentContext, {styles: content({size})}],
[FooterContext, {styles: footer}],
```

S2 에는 `CardContent`, `CardHeader`, `CardFooter` 라는 이름의 독립 컴포넌트가 **존재하지 않는다.** S2 는 범용 슬롯 컴포넌트 (`Content`, `Header`, `Footer`) 를 Card 컨텍스트 안에서 contextual styling 으로 재사용하는 방식을 채택.

#### 0-4. RSP classic Card 구조 분석

`@react-spectrum/card/src/index.ts` 에는:

```ts
export { CardView } from "...";
export { Card } from "...";
```

- **`CardView`** — RSP classic 에도 동일 이름 존재. S2 에도 `CardView.tsx` 동일 이름 존재.
- `CardHeader` / `CardContent` / `CardFooter` — RSP classic 에도 미존재.

#### 0-5. S2 Card 서브컴포넌트 (실제 export 이름)

`Card.tsx` export 이름 (S2):

```
Card              ← composition Card 와 이름 일치
CardPreview       ← composition CardPreview 와 이름 일치 (S2 별도 존재)
CollectionCardPreview
AssetCard         ← composition cardType: "asset" 에 대응
UserCard          ← composition cardType: "user" 에 대응
ProductCard       ← composition cardType: "product" 에 대응
```

**핵심 발견**: S2 는 `CardPreview`를 별도 컴포넌트로 export. composition 의 `CardPreview` tag (factory 직렬화) 는 S2 공식 이름과 일치.

#### 0-6. BC 재평가 매트릭스 (Phase 0)

| 식별자      |   ADR-098 분류   | Phase 0 재조사 결과                                             | S2/RSP 대응                                   | 실질 BC  |
| ----------- | :--------------: | --------------------------------------------------------------- | --------------------------------------------- | :------: |
| Card        | 후보 #8 (재조사) | `factory:LayoutComponents.ts:101` `tag:"Card"` DB 직렬화        | S2 `Card` 동일 이름                           | **HIGH** |
| CardHeader  | 후보 #8 (재조사) | `factory:LayoutComponents.ts:158` `tag:"CardHeader"` DB 직렬화  | S2/RSP **미존재** (S2 는 범용 `Header` 슬롯)  | **HIGH** |
| CardContent | 후보 #8 (재조사) | `factory:LayoutComponents.ts:186` `tag:"CardContent"` DB 직렬화 | S2/RSP **미존재** (S2 는 범용 `Content` 슬롯) | **HIGH** |
| CardFooter  | 후보 #8 (재조사) | `factory:LayoutComponents.ts:213` `tag:"CardFooter"` DB 직렬화  | S2/RSP **미존재** (S2 는 범용 `Footer` 슬롯)  | **HIGH** |
| CardView    | 후보 #8 (재조사) | `factory:DisplayComponents.ts:753` `tag:"CardView"` DB 직렬화   | RSP classic + S2 `CardView` **동일 이름**     | **HIGH** |
| CardPreview |    후보 #8 외    | `factory:LayoutComponents.ts:125` `tag:"CardPreview"` DB 직렬화 | S2 `CardPreview` **동일 이름**                | **HIGH** |

**시나리오 판정: 전체 시나리오 B (BC HIGH)** — Card 시리즈 6개 식별자 모두 factory 직렬화 tag 존재. 어떤 식별자도 제거/리네이밍 불가.

### RSP/S2 네이밍 차이 매트릭스 (확정)

| composition   | RSP/S2 공식 이름                               | 차이 유형       | 정당화 경로                          |
| ------------- | ---------------------------------------------- | --------------- | ------------------------------------ |
| `Card`        | `Card` (S2 동일)                               | 일치            | 일치 확증                            |
| `CardView`    | `CardView` (RSP classic + S2 동일)             | 일치            | 일치 확증                            |
| `CardPreview` | `CardPreview` (S2 동일)                        | 일치            | 일치 확증                            |
| `CardHeader`  | `Header` (S2 범용 슬롯, `CardHeader` 미존재)   | **구체화 이름** | D3 Compositional Architecture 정당화 |
| `CardContent` | `Content` (S2 범용 슬롯, `CardContent` 미존재) | **구체화 이름** | D3 Compositional Architecture 정당화 |
| `CardFooter`  | `Footer` (S2 범용 슬롯, `CardFooter` 미존재)   | **구체화 이름** | D3 Compositional Architecture 정당화 |

**결론**: `Card` / `CardView` / `CardPreview` 는 RSP/S2 공식 이름과 완전 일치. `CardHeader` / `CardContent` / `CardFooter` 는 S2 가 범용 슬롯 (`Header`/`Content`/`Footer`) 을 card context 에서 재사용하는 데 반해, composition 은 Card 전용 구체화 이름 (`Card-` prefix) 을 사용하는 차이.

### D1/D2/D3 Domain 판정

- **D3 (시각 스타일)**: CardHeader/CardContent/CardFooter 는 `containerStyles` + `sizes` 를 통해 layout primitive 를 D3 Spec SSOT 로 관리 (ADR-092 구현). D3 domain.
- **D2 (Props/API)**: S2 는 범용 `Content`/`Header`/`Footer` 이름 사용 → composition 의 Card-prefix 구체화가 RSP D2 기준 에서 명칭 차이. 그러나 ADR-092 에서 이미 `CardHeader/CardContent/CardFooter` spec 신설 + childSpecs 배선 완료 — BC HIGH 확인으로 D2 정합(리네이밍)은 불가.
- **D1 (DOM/접근성)**: CardHeader/CardContent/CardFooter 는 `element: "div"` 로 렌더링. ARIA 동작 없음. D1 무관.

### Hard Constraints

1. **BC HIGH 전체** — Card 시리즈 6개 식별자 모두 factory 직렬화 tag. 제거/리네이밍 = 기존 프로젝트 파괴.
2. **ADR-092 완비 상태** — CardHeader/CardContent/CardFooter spec 신설 (ADR-092 Phase 1-4) + ADR-095 propagation 확장까지 완결된 Implemented ADR 체인. 추가 코드 변경 불필요.
3. **ADR-093 childSpecs 배선** — CardHeader/CardContent/CardFooter 는 CardSpec.childSpecs 에 등록 (ADR-092 + ADR-094 expandChildSpecs 인프라). spec 이미 완비.
4. **testing 기준선** — type-check 3/3 + specs 205/205 + builder 227/227 + shared 52/52 PASS 유지.

### Soft Constraints

- ADR-098 Charter Decision: "composition 고유 네이밍은 Compositional Architecture 정당화 가능 시 유지 허용"
- ADR-100/101/102/103 선례 패턴 대칭 — "BC HIGH + Compositional Architecture 고유 element" 정당화 통일.
- S2 가 범용 슬롯 이름을 쓰는 이유: S2 는 Card 외 다른 컴포넌트 (Dialog, AlertDialog 등) 에서도 `Content`/`Header`/`Footer` 범용 슬롯을 재사용. composition 은 Card 전용 element tree 모델이므로 명시적 Card-prefix 가 구조 이해에 유리.

## Alternatives Considered

### 대안 A: 정당화 유지 — Card 시리즈 Compositional Architecture 고유 element 확증 (선정)

- 설명: CardHeader/CardContent/CardFooter 를 D3 시각 스타일 layout 슬롯 컨테이너로 정당화. S2 가 범용 슬롯 이름을 쓰는 이유는 S2 자체 컴포넌트 재사용 전략이며, composition 의 Card-prefix 구체화 이름은 Card 전용 element tree 구조에서 명시성을 높이는 D3 Compositional Architecture 결정임을 확증. Card/CardView/CardPreview 는 S2 공식 이름과 완전 일치 확인.
- 위험:
  - 기술: **LOW** — 정당화 문서 + spec 파일 주석 수준. Spec/factory/runtime 코드 변경 0.
  - 성능: **LOW**.
  - 유지보수: **LOW** — spec 완비, ADR-092/093 Compositional Architecture 유지. 변경 0.
  - 마이그레이션: **LOW** — migration 0건. 기존 저장 데이터 그대로.

### 대안 B: 리네이밍 — CardHeader→Header, CardContent→Content, CardFooter→Footer

- 설명: S2 범용 슬롯 이름을 따라 CardHeader/CardContent/CardFooter 를 각각 Header/Content/Footer 로 리네이밍. factory 직렬화 tag 변경 + migration 경로 구축.
- 위험:
  - 기술: **HIGH** — factory 직렬화 tag 변경 (`CardHeader`→`Header` 등) + `migrateCollectionItems` 패턴 이상의 일반 element tag migration 전례 없음. ADR-092 spec 이름 변경 + childSpecs 재배선 + implicitStyles 분기 (소문자 비교 포함) 전체 업데이트. 5+ 경로 동시 수정.
  - 성능: **LOW**.
  - 유지보수: **MED** — `Header`/`Content`/`Footer` 는 범용 이름으로 다른 컴포넌트 슬롯 (Section, Dialog 등) 과 tag 충돌 위험. Card-prefix 가 없으면 LayerTree/factory 에서 카드 슬롯 식별 복잡.
  - 마이그레이션: **HIGH** — 기존 Card 사용 프로젝트의 CardHeader/CardContent/CardFooter element tag migration 필요. `useElementCreator.ts:170-176` CardFooter routing 로직도 전면 재작성. 0% 재직렬화 불가.

### Risk Threshold Check

| 대안                         | 기술 | 성능 | 유지보수 | 마이그레이션 | HIGH+ 수 | 판정     |
| ---------------------------- | :--: | :--: | :------: | :----------: | :------: | -------- |
| A: 정당화 유지               |  L   |  L   |    L     |      L       |    0     | **PASS** |
| B: S2 슬롯 이름으로 리네이밍 |  H   |  L   |    M     |      H       |    2     | 기각     |

대안 A 가 HIGH 0 + 모든 축 LOW + BC 0% + ADR-100/101/102/103 패턴 대칭 → threshold pass.

**반복 패턴 선차단 체크** (adr-writing.md Top 1~4):

- ✅ **#1 코드 경로 인용**: Context 에서 `LayoutComponents.ts:101,125,158,186,213` + `DisplayComponents.ts:753` + `useElementCreator.ts:170-176` 7 경로 + occurrence 명시.
- ✅ **#2 Generator 확장 여부**: 정당화 유지 결정 — Spec/Generator/schema 확장 불필요. 주석 + 문서 수준 작업만.
- ✅ **#3 BC 훼손 수식화**: Card 시리즈 6개 식별자 **전체 BC HIGH** 확인. 대안 A 채택으로 실질 migration **0건 / 0% 파일 재직렬화**.
- ✅ **#4 Phase 분리 가능성**: Phase 0 (정당화 문서) + Phase 1 (spec 주석 sweep) + Phase 2 (README 갱신) 완전 독립.

## Decision

**대안 A (정당화 유지 — Card 시리즈 Compositional Architecture 고유 D3 레이아웃 슬롯 컨테이너 확증) 채택**.

선택 근거:

1. **Card / CardView / CardPreview 는 S2 공식 이름과 완전 일치** — Phase 0 재조사로 확증. S2 `Card.tsx` 에 `Card`/`CardPreview` export, RSP classic + S2 `CardView.tsx` 에 `CardView` 동일 이름.
2. **CardHeader/CardContent/CardFooter 는 D3 Compositional Architecture 고유 구체화 이름** — S2 가 범용 슬롯 이름 (`Header`/`Content`/`Footer`) 을 Card 컨텍스트에서 재사용하는 전략은 S2 자체 컴포넌트 생태계 (Dialog/AlertDialog 등 다중 컴포넌트가 동일 슬롯 재사용) 에 최적화된 설계. composition 은 Card 전용 element tree 모델이므로 Card-prefix 명시가 LayerTree/factory 구조 이해에 실질적 이점.
3. **BC HIGH 제거 불가** — factory `LayoutComponents.ts:158,186,213` 이 `tag:"CardHeader"` / `tag:"CardContent"` / `tag:"CardFooter"` element 를 DB 에 직렬화. 제거/리네이밍 시 기존 모든 Card 사용 프로젝트 슬롯 구조 소실. `useElementCreator.ts:170-176` CardFooter 자동 라우팅 로직도 전면 재작성 필요.
4. **ADR-092 spec 완비 상태** — `CardHeader/CardContent/CardFooter.spec.ts` 는 ADR-092 Phase 1 에서 신설, ADR-095 propagation 규칙까지 완전 구현. 추가 코드 변경 0.
5. **ADR-100/101/102/103 패턴 대칭** — SelectTrigger (ADR-100) / ComboBoxTrigger (ADR-101) / SelectIcon (ADR-102) / CheckboxItems+RadioItems (ADR-103) 과 동일한 "BC HIGH + Compositional Architecture 고유 element selfcontained 정당화" 경로.

기각 사유:

- **대안 B 기각**: HIGH 2 (기술 + 마이그레이션). CardHeader/CardContent/CardFooter element tag migration (전례 없는 일반 element tag rename migration) + 5+ 경로 전면 재작성. S2 슬롯 이름 통일이라는 D2 편의 목적으로 D3 Compositional Architecture 를 파괴하는 것은 SSOT 원칙에 역행. 또한 `Header`/`Content`/`Footer` 범용 tag 는 Section/Dialog 등 다른 컴포넌트 슬롯 tag 와 충돌 위험.

`CSSGenerator` / spec schema 확장 불필요. runtime DOM 은 이미 `<div>` 로 시각/레이아웃 전용 렌더링.

## Risks

| ID  | 위험                                                                                              | 심각도 | 대응                                                                                                 |
| --- | ------------------------------------------------------------------------------------------------- | :----: | ---------------------------------------------------------------------------------------------------- |
| R1  | S2 가 미래에 `CardHeader`/`CardContent`/`CardFooter` 별도 컴포넌트를 추가할 경우 일치 가능성 발생 |  LOW   | ADR-098 Charter R1 (RSP/RAC API 변동 재검증) 에 포함. 공식 출현 시 리네이밍 비용 0 (이미 동일 이름). |
| R2  | S2 가 Card 슬롯 이름을 `CardContent` 류로 구체화할 경우 대안 A 정당화 근거 약화                   |  LOW   | S2 의 범용 슬롯 전략 변경 없이는 발생 안 함. 모니터링만.                                             |
| R3  | `Header`/`Content`/`Footer` 범용 tag 가 미래 컴포넌트 추가 시 충돌                                |  LOW   | 현재 Section/Dialog/AlertDialog 슬롯은 다른 tag 사용. 충돌 시 별도 ADR 발행.                         |

잔존 HIGH 위험 없음.

## Gates

잔존 HIGH 위험 없음 — Gate 테이블 생략. 본 ADR 자체 검증 기준:

| 시점         | 통과 조건                                                                                                 |
| ------------ | --------------------------------------------------------------------------------------------------------- |
| Phase 0 완료 | RSP/S2 재조사 + BC 재평가 + 시나리오 판정 + 2 대안 평가 완료 (본 ADR 본문)                                |
| Phase 1 완료 | Card 시리즈 spec 파일 selfcontained 정당화 주석 sweep (5 파일)                                            |
| Phase 2 완료 | README.md ADR-104 Implemented 추가 + type-check 3/3 + specs 205/205 + builder 227/227 + shared 52/52 PASS |

## Consequences

### Positive

- **Card/CardView/CardPreview RSP/S2 일치 확증** — Phase 0 재조사로 3개 식별자의 S2 공식 이름 완전 일치 확인. composition 네이밍 품질 확증.
- **CardHeader/CardContent/CardFooter D3 domain 귀속 확증** — S2 범용 슬롯 전략과 composition Card-prefix 구체화 전략의 차이를 ADR 레벨에서 명문화. SSOT 체인 3-Domain 분할 준수 명확화.
- **BC HIGH 회피** — 기존 Card 사용 프로젝트 저장 데이터 재직렬화 비용 0. 대안 B 의 migration 부담 (전례 없는 element tag rename migration) 완전 제거.
- **ADR-098 Charter 098-f 슬롯 완결** — Charter 8번 후보 전체 완결. ADR-100/101/102/103/104 = 098-a~f 6개 슬롯 중 098-c(ADR-099 별도 구현)를 포함 전부 완결.
- **ADR-100~104 정당화 패턴 5종 통일** — SelectTrigger / ComboBoxTrigger / SelectIcon / CheckboxItems+RadioItems / Card 시리즈 모두 동일한 "Compositional Architecture 고유 element selfcontained 정당화" 패턴. 감사 체인 완결.

### Negative

- **S2 슬롯 이름 미매핑 지속** — composition `CardHeader` / `CardContent` / `CardFooter` 와 S2 범용 슬롯 `Header`/`Content`/`Footer` 의 명칭 divergence 유지. 신규 개발자 온보딩 시 문서 참조 필요.
- **Card-prefix 관례 확립** — CardHeader/CardContent/CardFooter 정당화가 확정됨에 따라 향후 Card 시리즈 신규 슬롯 추가 시 `Card-` prefix 관례를 따라야 함 (S2 범용 슬롯 이름 병행 금지).

## Card 시리즈 정당화 (ADR-098-f selfcontained)

ADR-098-f (composition 고유 네이밍 정당화 통합 문서) 본 ADR 이 Card 시리즈 정당화를 selfcontained 보존.

### Card / CardView / CardPreview — RSP/S2 일치 확증

| 식별자        | RSP/S2 공식 이름 | 출처                                                                | 확증    |
| ------------- | ---------------- | ------------------------------------------------------------------- | ------- |
| `Card`        | `Card`           | S2 `Card.tsx` `export const Card = forwardRef(...)`                 | ✅ 일치 |
| `CardView`    | `CardView`       | RSP classic `@react-spectrum/card/src/index.ts` + S2 `CardView.tsx` | ✅ 일치 |
| `CardPreview` | `CardPreview`    | S2 `Card.tsx` `export const CardPreview = forwardRef(...)`          | ✅ 일치 |

### CardHeader / CardContent / CardFooter — Compositional Architecture 고유 구체화 이름 정당화 근거

| #   | 근거                                                           | 코드 증거 (2026-04-21)                                                                                                                                                                                  |
| --- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **저장 식별자 고유성 — D3 layout 전용 슬롯 컨테이너**          | `apps/builder/src/builder/factories/definitions/LayoutComponents.ts:158,186,213` (`tag:"CardHeader"` / `tag:"CardContent"` / `tag:"CardFooter"` DB 직렬화)                                              |
| 2   | **Spec SSOT 완비 — ADR-092 containerStyles + sizes 완전 구현** | `packages/specs/src/components/CardHeader.spec.ts` (`containerStyles:{display:"flex",flexDirection:"row",alignItems:"center",width:"100%"}`) / `CardContent.spec.ts` / `CardFooter.spec.ts`             |
| 3   | **childSpecs 배선 — ADR-094 expandChildSpecs 경유 자동 등록**  | `packages/specs/src/components/Card.spec.ts:124` `childSpecs: [CardHeaderSpec, CardContentSpec, CardFooterSpec]` — TAG_SPEC_MAP / LOWERCASE_TAG_SPEC_MAP / tagToElement.ts 자동 혜택                    |
| 4   | **CardFooter 자동 라우팅 로직**                                | `apps/builder/src/builder/hooks/useElementCreator.ts:170-176` `el.tag === "CardFooter"` 분기 — Card action 컴포넌트를 CardFooter 로 자동 라우팅. 범용 `Footer` 로 리네이밍 시 이 분기 전면 재작성 필요. |

### S2 범용 슬롯 vs composition Card-prefix 구체화 — 전략 차이

S2 의 범용 슬롯 전략:

```
// S2: Card 에서 범용 슬롯 재사용
import {Content, Header, Footer} from '@react-spectrum/s2';
<Card>
  <Header><Heading>Title</Heading></Header>
  <Content>...</Content>
  <Footer>...</Footer>
</Card>
```

composition 의 Card-prefix 구체화 전략:

```
// composition: Card 전용 슬롯 element tree
Card (element)
  ├── CardPreview (element) — CardPreview tag 직렬화
  ├── CardHeader (element) — CardHeader tag 직렬화
  │     └── Heading (element)
  ├── CardContent (element) — CardContent tag 직렬화
  │     └── Description (element)
  └── CardFooter (element) — CardFooter tag 직렬화
```

차이 이유: S2 는 컴포넌트 library 로 개발자가 직접 JSX 구성. composition 은 no-code builder 로 element tree 를 DB 에 저장/복원. 범용 `Header`/`Content`/`Footer` tag 는 LayerTree/factory 에서 Card 슬롯 식별을 불명확하게 만들 수 있음. Card-prefix 구체화가 no-code builder 맥락에서 실질적 이점.

### 대안 B (리네이밍) 기각 근거 재확인

CardHeader/CardContent/CardFooter 리네이밍 시 발생하는 구체적 문제:

- **저장 데이터 파괴**: `tag:"CardHeader"` / `tag:"CardContent"` / `tag:"CardFooter"` 직렬화 element 소멸 → 기존 모든 Card 사용 프로젝트 슬롯 구조 파괴.
- **범용 tag 충돌 위험**: `Header`/`Content`/`Footer` 는 이미 범용 이름. 향후 Section/Dialog 등 다른 컴포넌트가 동일 tag 를 사용할 경우 충돌.
- **useElementCreator 라우팅 재작성**: `useElementCreator.ts:170-176` 의 `el.tag === "CardFooter"` 분기 — CardFooter 로 자동 라우팅하는 로직. `Footer` 로 변경 시 다른 `Footer` tag 와 혼동 가능.
- **ADR-092 Compositional Architecture 훼손**: ADR-092 는 CardHeader/CardContent/CardFooter spec 신설 + childSpecs 배선 + ADR-095 propagation 확장까지 완결된 Implemented ADR 체인. 리네이밍은 이 체인 전체 재작성.

D3 시각 SSOT 관점에서 CardHeader/CardContent/CardFooter 는 이미 `containerStyles` + `sizes` + `propagation` Spec 완비 상태로 완전 정합 — 리네이밍으로 얻는 이점 없음.

## 참조

- [ADR-098](098-rsp-naming-audit-charter.md) — RSP 네이밍 정합 감사 Charter (본 ADR 의 상위 charter, 098-f 슬롯)
- [ADR-092](092-card-slot-spec-modeling.md) — Card slot 모델링 ADR (CardHeader/CardContent/CardFooter spec 신설 + childSpecs 배선, 선행 결정)
- [ADR-094](094-childspecs-registry-auto-registration.md) — expandChildSpecs 인프라 (childSpecs 자동 등록 메커니즘)
- [ADR-095](095-propagation-style-injection-rule.md) — Propagation schema 확장 (CardHeader→Heading flex:1 / CardContent→Description width:100% 주입)
- [ADR-100](100-select-child-naming-rsp-alignment.md) — 098-a 슬롯 (SelectTrigger 정당화 선례)
- [ADR-101](101-combobox-child-naming-rsp-alignment.md) — 098-b 슬롯 (ComboBoxTrigger 정당화 선례)
- [ADR-102](102-select-icon-justification.md) — 098-d 슬롯 (SelectIcon 정당화 선례)
- [ADR-103](103-checkbox-radio-items-justification.md) — 098-e 슬롯 (CheckboxItems/RadioItems 정당화 선례)
- [ADR-063](063-ssot-chain-charter.md) — SSOT 체인 D1/D2/D3 domain 원칙
- [ssot-hierarchy.md](../../../.claude/rules/ssot-hierarchy.md) — 3-domain 정본
