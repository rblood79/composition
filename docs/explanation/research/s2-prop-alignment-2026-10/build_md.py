"""S2 prop 정렬 조사 — docs 문서 생성 (dataset.json → markdown).

§6 (결정 · 6.1 진행 기록) 은 손으로 고치는 절이라 기존 문서에서 그대로 옮긴다 — 다시 생성해도 지워지지 않는다.
"""
import json
import sys
from collections import defaultdict

data = json.load(open(sys.argv[1]))
out_path = sys.argv[2]

tot = {k: sum(len(x[k]) for x in data) for k in
       ("same", "diff", "rac", "v3", "own", "carry", "editor", "node", "s2vis", "s2link", "s2state", "s2behav")}
# 2026-10-09 첫 조사의 합계 (그때 dataset 은 git 이력 — 이 폴더의 2026-10-09 판).
FIRST = {"same": 400, "diff": 44, "rac": 43, "v3": 20, "own": 203, "carry": None, "editor": 44, "node": None,
         "s2vis": 130, "s2link": 66, "s2state": 105, "s2behav": 255, "types": 137, "compared": 710, "nos2": 56}
try:
    _prev = open(out_path).read()
    SECTION_6 = _prev[_prev.index("## 6. "):_prev.index("## 7. ")].rstrip("\n")
except (OSError, ValueError):
    SECTION_6 = "## 6. 결정이 필요한 것"
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
w("> 조사일 2026-10-09 · **현재 코드로 갱신 2026-10-13** (main `aa3133e6d` — size 표기 · F 묶음 삭제 · 6.1 「나」 · ADR-256 · 257 · 258 · 259 반영). "
  "기준: `@react-spectrum/s2` 1.8.0 · `react-aria-components` 1.22.1 (설치본 — 첫 조사는 1.21.0) · "
  f"`@adobe/react-spectrum` 3.47.6 (v3) · spectrum-design-data 3.4.0. 대상: composition catalog binding {len(data)}개.")
w(">")
w("> 공유 페이지 (같은 데이터, 검색 · 필터): https://claude.ai/artifact/TSv2HqnoefeSpe2ENMDSUJ")
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
w("2. 같은 방법으로 설치된 RAC 의 컴포넌트를 뽑았다 (`racprops.json` — 2026-10-13 갱신 때 1.22.1, 151개). S2 1.8.0 자체는 RAC 1.22.0 위에 있다.")
w("3. v3 는 `dist/types/src/**/*.d.ts` 174개에서 interface 가 선언한 prop 을 뽑았다 (상속분 제외). 그 survey 폴더는 저장소에 두지 않아, 2026-10-13 갱신은 첫 조사의 v3 판정 (`v3-2026-10-09.json`) 을 이어 썼다 — 그 뒤 새로 생긴 prop 이 v3 근거여도 「우리만」 으로 잡힐 수 있다.")
w("4. 우리 쪽은 catalog binding accepts (`ours.json`) 와 `COMPONENT_RULES_TABLE` 의 variant · size 이름 (`rules.json`) — `extract-ours.ts` 가 뽑는다.")
w("5. 비교에서 뺀 것: 전역 DOM · aria-* · 이벤트 핸들러 · `UNSAFE_*` · `styles` · `id` · `slot` · `children`. "
  "우리 편집기 고유 축 (`children` · `slot` · `dataBinding` · `aria-label`) 은 \"편집기 축\" 으로 따로 셌다. "
  "2026-10-13 갱신부터 둘을 더 따로 센다 — Design 패널에 없는 resolver 운반 값 (`editorHidden`) 은 \"내부 운반 값\", "
  "노드나 다른 자리가 맡는 S2 prop (노드로 들인 `contextualHelp` · `prefix`, 원본이 받는 prop, 6.1 「가」) 은 \"노드 · 다른 자리\" (둘 다 비교 제외).")
w("6. 판정 순서: S2 에 같은 이름 → (enum 이면 값 집합 비교) → RAC 에 있음 → v3 에 있음 → 우리만.")
w("7. 이름 대응: Select→Picker · Separator→Divider · Tree(Item)→TreeView(Item) · GridList(Item)→ListView(Item) · "
  "Table→TableView · Toast→ToastContainer · Nav→SideNav · Kbd→Keyboard · ListBoxItem→PickerItem.")
w("")
w("한계: origin (원본) 의 template 바인딩 prop 은 type 의 prop 으로 비교하지 않는다 — S2 에서는 대부분 children 조립이다 (원본이 받는 prop 이 S2 에 있으면 \"노드 · 다른 자리\"). "
  "S2 의 Tooltip · Toast 는 호출 가능한 컴포넌트 타입이 아니어서 prop 이 뽑히지 않았다 (Tooltip `variant` 는 v3 · design-data 로 판정).")
w("")
w("## 3. 요약")
w("")
w("| 분류 | 2026-10-09 | 2026-10-13 | 뜻 |")
w("|---|---:|---:|---|")
def _f(k): return "—" if FIRST[k] is None else FIRST[k]
w(f"| S2 와 같음 | {_f('same')} | {tot['same']} | 이름이 같고, enum 이면 값 집합도 같음 |")
w(f"| 값이 다름 | {_f('diff')} | {tot['diff']} | 이름은 같고 값 집합이 다름 |")
w(f"| RAC 근거 | {_f('rac')} | {tot['rac']} | S2 에는 없지만 RAC 컴포넌트가 받는 prop (D1 근거) |")
w(f"| v3 근거 | {_f('v3')} | {tot['v3']} | S2 · RAC 에 없고 v3 에 있음 |")
w(f"| 우리만 | {_f('own')} | {tot['own']} | S2 · RAC · v3 어디에도 없음 |")
w(f"| (내부 운반 값) | {_f('carry')} | {tot['carry']} | Design 패널에 없는 resolver 파생 값 — 비교 제외 (첫 조사는 「우리만」 등에 섞임) |")
w(f"| (편집기 축) | {_f('editor')} | {tot['editor']} | `children` · `slot` · `dataBinding` · `aria-label` — 비교 제외 |")
w(f"| (노드 · 다른 자리) | {_f('node')} | {tot['node']} | 노드 · 원본 · 다른 prop 이 맡는 S2 prop — 비교 제외 (첫 조사는 「S2 에만」 에 섞임) |")
w(f"| S2 에만 — 시각 · 내용 | {_f('s2vis')} | {tot['s2vis']} | 우리에 없는 S2 prop |")
w(f"| S2 에만 — 링크 · 상태 · 동작 | {FIRST['s2link']} · {FIRST['s2state']} · {FIRST['s2behav']} | {tot['s2link']} · {tot['s2state']} · {tot['s2behav']} | 노드 · interaction · 선택 상태가 대신 다루는 축 |")
w("")
w(f"비교한 우리 prop {compared}개 중 {tot['same']}개 ({round(tot['same'] * 100 / compared)}%) 가 S2 와 같다 "
  f"(2026-10-09: {FIRST['compared']}개 중 {FIRST['same']}개, {round(FIRST['same'] * 100 / FIRST['compared'])}%). "
  f"S2 에 대응 컴포넌트가 없는 우리 type 은 {len(no_s2)}개다 (부품 · 확장): {', '.join(no_s2)}.")
w("")
w("## 4. 시각 축 조사 (variant · isEmphasized · fillStyle · staticColor · isQuiet · density)")
w("")
w("### 4.1 레퍼런스별 규칙")
w("")
w("- **RAC 1.21.0** (첫 조사): 본체 타입에 이 축이 하나도 없다 (unstyled). react-aria.adobe.com starter 예제만 자체 `variant` 를 둔다 "
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
w("| 묶음 | 대상 | 조치 | 현재 (2026-10-13) |")
w("|---|---|---|---|")
w("| A. 그대로 | Button (`variant` · `fillStyle` · `staticColor`) · Badge · StatusLight · Card · Link · ToggleButton(Group) · ProgressCircle/ProgressBar `staticColor` · Toast · Select `isQuiet` · GridList `isQuiet` · ColorSwatchPicker · TableView · Tabs `density` | 없음 | 유지 |")
w("| B. 이름 변경 | Checkbox · Switch `variant` → `isEmphasized` · CheckboxGroup · RadioGroup `variant` → `isEmphasized` (그룹이 자식에게) · Radio `variant` 삭제 · Form `variant` → `isEmphasized` · TableView `variant` quiet → `isQuiet` · Tree `variant` → `isEmphasized` (design-data) | contract 변경 | 완료 — 옛 `variant` 는 로드 시 1회 전환, 남은 `variant` 는 resolver 파생 운반 값 (5.7). Tree `isEmphasized` 는 design-data 근거라 「우리만」 |")
w("| C. 값 변경 | Meter `warning`/`critical` → `notice`/`negative` + `staticColor` · InlineAlert `info` → `informative` + `fillStyle` · CardView `variant` → primary/secondary/tertiary/quiet · Tooltip → neutral/informative/negative (design-data) | contract 변경 | 완료 — 단 InlineAlert `fillStyle` 값 이름은 design-data (outline · subtle · bold) 라 S2 코드 (border · subtleFill · boldFill) 와 다르다 (5.1) |")
w("| D. 추가 | Slider `isEmphasized` · TagGroup `isEmphasized` · Avatar `isOverBackground` · Disclosure `isQuiet` · `density` · Separator `staticColor` | 추가만 | 완료 |")
w("| E. v3 근거 유지 | field `isQuiet` (TextField · TextArea · ComboBox · SearchField · NumberField · DateField · DatePicker · TimeField · ColorField) | S2 가 뺀 축임을 알고 유지 | 유지 |")
w("| F. 어디에도 없음 | ProgressBar `variant` · Table `variant` striped/bordered · Separator `variant` · Calendar · RangeCalendar · CalendarGrid · ListBox · GridList · DisclosureGroup · Toolbar · FileTrigger · Skeleton · Pagination · Nav · ColorSwatchPicker · Section · ColorPicker · Chart `variant` | 확장 유지 / 삭제 결정 | **삭제 (2026-10-12 사용자 결정)** — Tabs 포함 21 type, rule 은 기본 변형만, 옛 문서는 로드 시 1회 삭제 |")
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
w(f"`size` 는 표기를 S2 로 바꿨고 (2026-10-09 결정 — `XS` · `S` · `M` · `L` · `XL`) 범위는 type 마다 그대로라, 남은 {sum(1 for x in data for d in x['diff'] if d['prop'] == 'size')}개 (첫 조사 39) 는 단계 수 차이다 — 우리에만 `XS` 가 있거나 S2 의 `XS` · `XL` 을 두지 않았다. `firstDayOfWeek` 의 빈 값은 「locale 기본」 이다.")
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
w("부품 type 의 `size` (owner 가 주는 값) · Chart · FileUpload (확장) · `locale` · `calendarSystem` (RAC 는 `I18nProvider` 로 받는다) 가 대부분이다. Design 패널에 없는 운반 값은 5.7 에 따로 있다.")
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
w("| type | S2 | 같음 | 값이 다름 | RAC 근거 | v3 근거 | 우리만 | 노드 · 다른 자리 | S2 에만 (시각·내용) | S2 링크·상태·동작 |")
w("|---|---|---|---|---|---|---|---|---|---:|")
for x in data:
    s2n = x["s2"] or "—"
    if x["s2"] and x["s2"] == x["type"]:
        s2n = "="
    diff = "; ".join(f"`{d['prop']}`" for d in x["diff"])
    w(f"| {x['type']} | {s2n} | {code(x['same'])} | {diff} | {code(x['rac'])} | {code(x['v3'])} | {code(x['own'])} | "
      f"{code(x['node'])} | {code(x['s2vis'])} | {len(x['s2link']) + len(x['s2state']) + len(x['s2behav']) or ''} |")
w("")
w("### 5.7 내부 운반 값 (비교 제외)")
w("")
w("binding 이 `editorHidden` 으로 받는 값 — Design 패널에 없고 resolver 가 부모 · 다른 prop 에서 파생해 싣는다 (예: Switch · Radio 의 `variant` 는 `isEmphasized` 에서, 부품의 `size` 는 owner 에서).")
w("")
w("| prop | 개수 | type |")
w("|---|---:|---|")
for p, ts in group("carry"):
    w(f"| `{p}` | {len(ts)} | {', '.join(ts)} |")
w("")
w("### 5.8 노드 · 다른 자리 (비교 제외)")
w("")
w("S2 는 prop 인데 우리는 노드 · 원본 prop · 다른 prop 이 맡는 것.")
w("")
w("| type | prop | 맡는 곳 |")
w("|---|---|---|")
for x in data:
    for p in x["node"]:
        w(f"| {x['type']} | `{p}` | {x['nodeWhy'].get(p, '')} |")
w("")
for _line in SECTION_6.split("\n"):
    w(_line)
w("")
w("## 7. 데이터와 재현")
w("")
w("[`s2-prop-alignment-2026-10/`](s2-prop-alignment-2026-10/) 에 원본 데이터와 스크립트가 있다.")
w("")
w("| 파일 | 내용 |")
w("|---|---|")
w("| `s2props.json` · `racprops.json` | S2 1.8.0 · RAC 1.22.1 컴포넌트별 prop (이름 → 타입 문자열 · 선언 출처) |")
w("| `ours.json` · `rules.json` | catalog binding accepts (`hidden` = `editorHidden`) · rule variant/size 이름 |")
w("| `v3-2026-10-09.json` | 첫 조사의 v3 근거 판정 (type · prop) — v3 survey 폴더 없이 다시 분류할 때 이어 쓴다 |")
w("| `dataset.json` | type 별 분류 결과 (이 문서와 공유 페이지의 입력) |")
w("| `probe-props.cjs` | TypeScript 검사기로 컴포넌트 props 를 펼치는 스크립트 |")
w("| `extract-ours.ts` | `ours.json` · `rules.json` 을 현재 catalog 에서 뽑는 스크립트 |")
w("| `dataset.py` · `build_md.py` · `build_html.py` | 분류 · 이 문서 생성 (§6 은 기존 문서에서 옮김) · 공유 페이지 생성 |")
w("")
w("재현: S2 를 격리 폴더에 `npm install --ignore-scripts @react-spectrum/s2@1.8.0` 한 뒤 "
  "`export * from \"@react-spectrum/s2\";` 한 줄 entry 를 두고 `node probe-props.cjs <typescript 경로> <entry> <out.json>`. "
  "RAC 는 저장소 안에 같은 entry (`react-aria-components`) 를 두고 실행한다. "
  "다시 재기: `pnpm -F @composition/rendering exec tsx \"$PWD/<이 폴더>/extract-ours.ts\" <이 폴더>` → `python3 dataset.py <이 폴더>` → "
  "`python3 build_md.py dataset.json ../S2_PROP_ALIGNMENT_2026-10.md` · `python3 build_html.py dataset.json <out.html>`.")
open(out_path, "w").write("\n".join(L) + "\n")
print("wrote", out_path, len(L), "lines")
