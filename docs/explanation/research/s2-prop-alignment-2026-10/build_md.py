"""S2 prop 정렬 조사 — docs 문서 생성 (dataset.json → markdown)."""
import json
import sys
from collections import defaultdict

data = json.load(open(sys.argv[1]))
out_path = sys.argv[2]

tot = {k: sum(len(x[k]) for x in data) for k in
       ("same", "diff", "rac", "v3", "own", "editor", "s2vis", "s2link", "s2state", "s2behav")}
compared = tot["same"] + tot["diff"] + tot["rac"] + tot["v3"] + tot["own"]
no_s2 = [x["type"] for x in data if not x["s2"]]


def code(items):
    return ", ".join(f"`{i}`" for i in items) if items else ""


def group(key):
    g = defaultdict(list)
    for x in data:
        for p in x[key]:
            g[p].append(x["type"])
    return sorted(g.items(), key=lambda kv: (-len(kv[1]), kv[0]))


L = []
w = L.append
w("# S2 프로퍼티 정렬 조사 — 2026-10")
w("")
w("> 조사일 2026-10-09. 기준: `@react-spectrum/s2` 1.8.0 · `react-aria-components` 1.21.0 (설치본) · "
  "`@adobe/react-spectrum` 3.47.6 (v3) · spectrum-design-data 3.4.0. 대상: composition catalog binding 137개.")
w(">")
w("> 이 문서는 조사 기록이다. 정본 규칙은 [`.claude/rules/ssot-hierarchy.md`](../../../.claude/rules/ssot-hierarchy.md) D2 절이고, "
  "prop 을 실제로 바꾸는 일은 별도 작업 (contract 변경 포함) 으로 진행한다.")
w("")
w("## 1. 배경과 결정")
w("")
w("- composition 은 테마를 바꿀 수 있도록 headless 인 RAC 를 채택했다 (D1). prop 개념은 React Spectrum 을 따랐는데, "
  "기준이 \"RSP 참조\" 로만 적혀 있어 v3 와 S2 의 이름이 섞였다 (예: Meter `warning` · `critical` 은 v3, "
  "Checkbox `variant` 는 S2 · v3 의 `isEmphasized` 와 다름).")
w("- Adobe 의 층: Spectrum 디자인 시스템 (design-data) → React Aria / RAC (동작 기반, 시각 축 없음) → "
  "v3 (Spectrum 1 구현, react-aria hooks 기반) · S2 (Spectrum 2 구현, RAC 기반). v3 는 S2 의 상위가 아니다.")
w("- **사용자 결정 (2026-10-09)**: D2 (prop 이름 · 값) 정본 순서 = **S2 1.8.0 (고정) → design-data → v3 → composition 확장**. "
  "S2 는 RAC 위의 구현이라 동작 · 상태 prop 은 RAC 이름, 시각 prop 은 Spectrum 축이다. 시각 값은 D3 (catalog) 가 정본이다.")
w("")
w("## 2. 방법")
w("")
w("1. S2 1.8.0 을 격리 폴더에 설치하고 TypeScript 타입 검사기로 컴포넌트 125개의 props 타입을 상속까지 펼쳐 prop 이름과 타입을 뽑았다 (`s2props.json`).")
w("2. 같은 방법으로 설치된 RAC 1.21.0 의 컴포넌트 146개를 뽑았다 (`racprops.json`). S2 1.8.0 자체는 RAC 1.22.0 위에 있다.")
w("3. v3 는 `dist/types/src/**/*.d.ts` 174개에서 interface 가 선언한 prop 을 뽑았다 (상속분 제외).")
w("4. 우리 쪽은 `componentCatalog` 의 binding accepts (`ours.json`) 와 `COMPONENT_RULES_TABLE` 의 variant · size 이름 (`rules.json`).")
w("5. 비교에서 뺀 것: 전역 DOM · aria-* · 이벤트 핸들러 · `UNSAFE_*` · `styles` · `id` · `slot` · `children`. "
  "우리 편집기 고유 축 (`children` · `slot` · `dataBinding` · `aria-label`) 은 \"편집기 축\" 으로 따로 셌다.")
w("6. 판정 순서: S2 에 같은 이름 → (enum 이면 값 집합 비교) → RAC 에 있음 → v3 에 있음 → 우리만.")
w("7. 이름 대응: Select→Picker · Separator→Divider · Tree(Item)→TreeView(Item) · GridList(Item)→ListView(Item) · "
  "Table→TableView · Toast→ToastContainer · Nav→SideNav · Kbd→Keyboard · ListBoxItem→PickerItem.")
w("")
w("한계: origin (원본) 의 template 바인딩 prop (Card `title`, AvatarGroup `label` 등) 은 비교하지 않았다 — S2 에서는 대부분 children 조립이다. "
  "S2 의 Tooltip · Toast 는 호출 가능한 컴포넌트 타입이 아니어서 prop 이 뽑히지 않았다 (Tooltip `variant` 는 v3 · design-data 로 판정).")
w("")
w("## 3. 요약")
w("")
w("| 분류 | 개수 | 뜻 |")
w("|---|---:|---|")
w(f"| S2 와 같음 | {tot['same']} | 이름이 같고, enum 이면 값 집합도 같음 |")
w(f"| 값이 다름 | {tot['diff']} | 이름은 같고 값 집합이 다름 |")
w(f"| RAC 근거 | {tot['rac']} | S2 에는 없지만 RAC 컴포넌트가 받는 prop (D1 근거) |")
w(f"| v3 근거 | {tot['v3']} | S2 · RAC 에 없고 v3 에 있음 |")
w(f"| 우리만 | {tot['own']} | S2 · RAC · v3 어디에도 없음 |")
w(f"| (편집기 축) | {tot['editor']} | `children` · `slot` · `dataBinding` · `aria-label` — 비교 제외 |")
w(f"| S2 에만 — 시각 · 내용 | {tot['s2vis']} | 우리에 없는 S2 prop |")
w(f"| S2 에만 — 링크 · 상태 · 동작 | {tot['s2link']} · {tot['s2state']} · {tot['s2behav']} | 노드 · interaction · 선택 상태가 대신 다루는 축 |")
w("")
w(f"비교한 우리 prop {compared}개 중 {tot['same']}개 ({round(tot['same'] * 100 / compared)}%) 가 S2 와 같다. "
  f"S2 에 대응 컴포넌트가 없는 우리 type 은 {len(no_s2)}개다 (부품 · 확장): {', '.join(no_s2)}.")
w("")
w("## 4. 시각 축 조사 (variant · isEmphasized · fillStyle · staticColor · isQuiet · density)")
w("")
w("### 4.1 레퍼런스별 규칙")
w("")
w("- **RAC 1.21.0**: 본체 타입에 이 축이 하나도 없다 (unstyled). react-aria.adobe.com starter 예제만 자체 `variant` 를 둔다 "
  "(Button · ToggleButton `primary | secondary | quiet`, Link `primary | secondary`) — 권위 없음.")
w("- **S2 1.8.0**: 강조는 `isEmphasized` (Checkbox · CheckboxGroup · Switch · RadioGroup · Slider · TagGroup · ToggleButton(Group) · Form · ActionBar), "
  "의미 · 색은 `variant` (Button · Badge · StatusLight · Card · Link · Meter · InlineAlert · Toast · AlertDialog), "
  "칠 방식은 `fillStyle` (Button · Badge · InlineAlert), 유색 배경은 `staticColor`, 조용한 형태 `isQuiet` 는 Picker · Link · ActionButton · TableView · ListView · Disclosure · Accordion 에만.")
w("- **v3 3.47.6**: `isEmphasized` (Checkbox(Group) · Switch · RadioGroup · ToggleButton · Tabs · Form · ActionGroup · ListView), "
  "`isQuiet` 은 거의 모든 field, `variant` 값이 S2 와 일부 다름 (Meter `warning`/`critical`, InlineAlert · Tooltip `info`).")
w("- **design-data 3.4.0** (S2 에 없는 축 판정용): Checkbox · Radio button `isEmphasized`, Meter `informative/positive/notice/negative`, "
  "Tooltip `variant` neutral/informative/negative, Tree view `isEmphasized` · `size`, Table `isQuiet` · `density` (\"Don't use zebra stripes\"), "
  "In-line alert `style` bold/subtle/outline (S2 코드는 `fillStyle` border/subtleFill/boldFill — 디자인 정본과 S2 코드도 일부 다르다). "
  "text-field · combo-box · number-field · date-picker · search-field 에는 `isQuiet` 이 없다.")
w("")
w("### 4.2 새 기준으로 다시 나눈 시각 축")
w("")
w("| 묶음 | 대상 | 조치 |")
w("|---|---|---|")
w("| A. 그대로 | Button (`variant` · `fillStyle` · `staticColor`) · Badge · StatusLight · Card · Link · ToggleButton(Group) · ProgressCircle/ProgressBar `staticColor` · Toast · Select `isQuiet` · GridList `isQuiet` · ColorSwatchPicker · TableView · Tabs `density` | 없음 |")
w("| B. 이름 변경 | Checkbox · Switch `variant` → `isEmphasized` · CheckboxGroup · RadioGroup `variant` → `isEmphasized` (그룹이 자식에게) · Radio `variant` 삭제 · Form `variant` → `isEmphasized` · TableView `variant` quiet → `isQuiet` · Tree `variant` → `isEmphasized` (design-data) | contract 변경 |")
w("| C. 값 변경 | Meter `warning`/`critical` → `notice`/`negative` + `staticColor` · InlineAlert `info` → `informative` + `fillStyle` · CardView `variant` → primary/secondary/tertiary/quiet · Tooltip → neutral/informative/negative (design-data) | contract 변경 |")
w("| D. 추가 | Slider `isEmphasized` · TagGroup `isEmphasized` · Avatar `isOverBackground` · Disclosure `isQuiet` · `density` · Separator `staticColor` | 추가만 |")
w("| E. v3 근거 유지 | field `isQuiet` (TextField · TextArea · ComboBox · SearchField · NumberField · DateField · DatePicker · TimeField · ColorField) | S2 가 뺀 축임을 알고 유지 |")
w("| F. 어디에도 없음 | ProgressBar `variant` · Table `variant` striped/bordered · Separator `variant` · Calendar · RangeCalendar · CalendarGrid · ListBox · GridList · DisclosureGroup · Toolbar · FileTrigger · Skeleton · Pagination · Nav · ColorSwatchPicker · Section · ColorPicker · Chart `variant` | 확장 유지 / 삭제 결정 필요 |")
w("")
w("## 5. 전체 prop 대조")
w("")
w("### 5.1 값이 다름")
w("")
w("| type | prop | 우리 | S2 |")
w("|---|---|---|---|")
for x in data:
    for d in x["diff"]:
        w(f"| {x['type']} | `{d['prop']}` | {' · '.join(d['ours'])} | {' · '.join(d['s2'])} |")
w("")
w("`size` 가 39개로 대부분이다. S2 는 `S · M · L · XL` (일부 `XS`), 우리는 `xs · sm · md · lg · xl` 이며 S2 에 없는 `xs` 단계가 여러 type 에 있다.")
w("")
w("### 5.2 v3 근거")
w("")
w("| prop | type |")
w("|---|---|")
for p, ts in group("v3"):
    w(f"| `{p}` | {', '.join(ts)} |")
w("")
w("### 5.3 RAC 근거 (S2 에는 없음)")
w("")
w("| prop | type |")
w("|---|---|")
for p, ts in group("rac"):
    w(f"| `{p}` | {', '.join(ts)} |")
w("")
w("### 5.4 우리만 (S2 · RAC · v3 에 없음)")
w("")
w("부품 type 의 `size` (owner 가 주는 내부 값) · Chart · FileUpload (확장) · `locale` · `calendarSystem` (RAC 는 `I18nProvider` 로 받는다) 가 대부분이다.")
w("")
w("| prop | 개수 | type |")
w("|---|---:|---|")
for p, ts in group("own"):
    w(f"| `{p}` | {len(ts)} | {', '.join(ts)} |")
w("")
w("### 5.5 S2 에만 — 시각 · 내용")
w("")
w("| prop | 개수 | type |")
w("|---|---:|---|")
for p, ts in group("s2vis"):
    w(f"| `{p}` | {len(ts)} | {', '.join(ts)} |")
w("")
w("### 5.6 컴포넌트별 전체 표")
w("")
w("S2 열의 `—` 는 S2 에 대응 컴포넌트가 없음. 링크 · 상태 · 동작 열은 S2 에만 있는 해당 prop 수.")
w("")
w("| type | S2 | 같음 | 값이 다름 | RAC 근거 | v3 근거 | 우리만 | S2 에만 (시각·내용) | S2 링크·상태·동작 |")
w("|---|---|---|---|---|---|---|---|---:|")
for x in data:
    s2n = x["s2"] or "—"
    if x["s2"] and x["s2"] == x["type"]:
        s2n = "="
    diff = "; ".join(f"`{d['prop']}`" for d in x["diff"])
    w(f"| {x['type']} | {s2n} | {code(x['same'])} | {diff} | {code(x['rac'])} | {code(x['v3'])} | {code(x['own'])} | "
      f"{code(x['s2vis'])} | {len(x['s2link']) + len(x['s2state']) + len(x['s2behav']) or ''} |")
w("")
w("## 6. 결정이 필요한 것")
w("")
w("1. **`size` 표기와 범위** — 39개 type. S2 `S/M/L/XL` 로 맞출지, `xs` 단계와 일부 `xl` 을 어떻게 할지.")
w("2. **S2 에만 있는 시각 · 내용 prop 도입 범위** — 130개. `contextualHelp` (16) · `isEmphasized` (7) · `prefix` (5) · `labelAlign` · `formatOptions` · `firstDayOfWeek` · `overflowMode` (각 4) 순.")
w("3. **4.2 의 F 묶음** — 어디에도 없는 `variant` 를 확장으로 남길지 지울지 (항목별).")
w("4. **B · C 의 contract 변경** — 한 번의 contract 변경으로 묶을지.")
w("")
w("## 7. 데이터와 재현")
w("")
w("[`s2-prop-alignment-2026-10/`](s2-prop-alignment-2026-10/) 에 원본 데이터와 스크립트가 있다.")
w("")
w("| 파일 | 내용 |")
w("|---|---|")
w("| `s2props.json` · `racprops.json` | S2 1.8.0 · RAC 1.21.0 컴포넌트별 prop (이름 → 타입 문자열 · 선언 출처) |")
w("| `ours.json` · `rules.json` | catalog binding accepts · rule variant/size 이름 |")
w("| `dataset.json` | type 별 분류 결과 (이 문서와 공유 페이지의 입력) |")
w("| `probe-props.cjs` | TypeScript 검사기로 컴포넌트 props 를 펼치는 스크립트 |")
w("| `dataset.py` · `build_md.py` | 분류 · 이 문서 생성 |")
w("")
w("재현: S2 를 격리 폴더에 `npm install --ignore-scripts @react-spectrum/s2@1.8.0` 한 뒤 "
  "`export * from \"@react-spectrum/s2\";` 한 줄 entry 를 두고 `node probe-props.cjs <typescript 경로> <entry> <out.json>`. "
  "RAC 는 저장소 안에 같은 entry (`react-aria-components`) 를 두고 실행한다.")
open(out_path, "w").write("\n".join(L) + "\n")
print("wrote", out_path, len(L), "lines")
