// ADR-321 Phase 0 시제품 — breakdown §4 의 조립 표 그대로 만든 작은 StepList · Rating (제품 코드가 아니다).
// 판정은 `adr321-phase0-prototypes.mjs` 가 실제 Chrome 의 접근성 트리 · DOM 속성 · range input 값으로 한다.
//   p1   `ol > li > RAC Link` (`aria-current="step"` · `isDisabled`) — 접근성 트리 · Tab 순서 · Enter 활성
//   p2   RAC `Slider` (0 ~ 5 · step 1) 의 track 위 별 다섯 — track 배치 셋 (naive · shifted · shifted-slots) 에서
//        별의 왼쪽 · 가운데 · 오른쪽을 누른 값, 화살표, 범위 밖 · 단계 사이 값, RAC `Meter` 의 낭독 값
// D1 예외 0 (HC2): 이 파일에는 role · aria 속성의 직접 작성도, 키 handler 도, react-aria 의 private hook 도 없다.
// RAC 부품에 prop 으로 넘기는 `aria-current` · `aria-label` 만 있다 (실행 스크립트가 이 파일을 정적 검사한다).
import { createElement as h, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { VisuallyHidden } from "react-aria";
import {
  Button,
  Link,
  Meter,
  Slider,
  SliderThumb,
  SliderTrack,
} from "react-aria-components";

/**
 * §5.2 상태 규칙 (선형) — 완료 = `lastCompletedStep` 이하, 갈 수 있음 = 완료된 단계 · 바로 앞이 완료된
 * 단계 · 첫 단계 (비활성이면 없음).
 */
export function stepStates(keys, selectedKey, lastCompletedStep, disabledKeys) {
  const last = lastCompletedStep == null ? -1 : keys.indexOf(lastCompletedStep);
  return keys.map((key, index) => {
    const completed = last >= 0 && index <= last;
    return {
      key,
      index,
      completed,
      current: key === selectedKey,
      selectable:
        !disabledKeys.includes(key) &&
        (completed || index === 0 || index - 1 <= last),
    };
  });
}

/** 선택이 비면 완료 · 비활성이 아닌 첫 단계 (§5.2 마지막 줄). */
function defaultStep(keys, lastCompletedStep, disabledKeys) {
  const last = lastCompletedStep == null ? -1 : keys.indexOf(lastCompletedStep);
  return (
    keys.find(
      (key, index) =>
        index === keys.length - 1 ||
        (!disabledKeys.includes(key) && index > last),
    ) ?? null
  );
}

const STATE_TEXT = { current: "현재", completed: "완료", rest: "남음" };

function StepList({ fixture }) {
  const keys = fixture.steps.map((step) => step.key);
  const disabledKeys = fixture.disabledKeys ?? [];
  const [last, setLast] = useState(fixture.lastCompletedStep ?? null);
  const [selected, setSelected] = useState(
    fixture.selectedKey ?? defaultStep(keys, last, disabledKeys),
  );
  const states = stepStates(keys, selected, last, disabledKeys);
  const select = (key) => {
    const previous = keys[keys.indexOf(key) - 1];
    if (previous && keys.indexOf(previous) > keys.indexOf(last ?? ""))
      setLast(previous);
    setSelected(key);
  };
  return h(
    "div",
    { className: "p1", "data-fixture": fixture.id },
    h(Button, { "data-edge": "before" }, `${fixture.id} 앞`),
    h(
      "ol",
      { className: "steplist", "data-list": fixture.id },
      states.map((state) =>
        h(
          "li",
          { key: state.key, "data-state": stateName(state) },
          h(
            Link,
            {
              "aria-current": state.current ? "step" : undefined,
              isDisabled: !state.selectable,
              onPress: () => select(state.key),
              "data-step": state.key,
              className: "step",
            },
            h(
              "span",
              { className: "visual" },
              state.completed && !state.current ? "" : String(state.index + 1),
            ),
            h("span", { className: "label" }, fixture.steps[state.index].label),
            h(VisuallyHidden, null, STATE_TEXT[stateName(state)]),
          ),
        ),
      ),
    ),
    h(Button, { "data-edge": "after" }, `${fixture.id} 뒤`),
    h(
      Button,
      {
        "data-edge": "complete",
        onPress: () => {
          setLast(selected);
          const next = keys[keys.indexOf(selected) + 1];
          if (next) setSelected(next);
        },
      },
      "단계 완료 · 다음 단계",
    ),
  );
}
const stateName = (state) =>
  state.current ? "current" : state.completed ? "completed" : "rest";

const STARS = [1, 2, 3, 4, 5];

/**
 * 별점 입력 — RAC `Slider > SliderTrack > SliderThumb`. 별은 track 의 자식인 장식이다 (글자 없는 span).
 * `arm` 은 track 의 배치만 바꾼다 (CSS — 아래 `STYLE`).
 */
function Rating({ id, arm, size, initial }) {
  const [value, setValue] = useState(initial ?? 0);
  useEffect(() => {
    (window.__rating ??= {})[id] = { set: setValue };
  }, [id]);
  return h(
    Slider,
    {
      value,
      onChange: setValue,
      minValue: 0,
      maxValue: 5,
      step: 1,
      "aria-label": "평점",
      className: `rating ${arm}`,
      "data-rating": id,
      "data-size": size,
    },
    h(SliderTrack, { className: "track" }, ({ state }) => [
      ...STARS.map((star) =>
        h(
          "span",
          { key: star, className: "slot", "data-star": star },
          h("span", {
            className: "star",
            "data-filled": star <= state.values[0] ? "" : undefined,
          }),
        ),
      ),
      h(SliderThumb, { key: "thumb", className: "thumb" }),
    ]),
  );
}

/** 범위 밖 · 단계 사이 값을 준 Slider (F11) — `mode` 는 제어 (`value`) · 비제어 (`defaultValue`). */
function OddSlider({ id, given, mode }) {
  return h(
    Slider,
    {
      [mode === "controlled" ? "value" : "defaultValue"]: given,
      minValue: 0,
      maxValue: 5,
      step: 1,
      "aria-label": `별점 ${given}`,
      className: "odd",
      "data-odd": id,
    },
    h(SliderTrack, { className: "oddtrack" }, h(SliderThumb, null)),
  );
}

const SIZES = { M: { star: 18, gap: 4 }, S: { star: 16, gap: 4 } };

// 배치 셋. `slot` = 별 + 간격. naive: track 상자 = 별 줄 (5 별 + 4 간격). shifted: track 폭 = slot × 5,
// 별 줄에서 왼쪽으로 slot ÷ 2 + 간격 ÷ 2 만큼 — 별 i 의 가운데가 track 의 i ÷ 5 자리. shifted-slots:
// shifted 에서 track 은 포인터를 받지 않고 slot 만 받는다 (별 줄 밖 왼쪽의 「0」 자리를 없앤다).
const armCss = (size, { star, gap }) => {
  const slot = star + gap;
  const row = star * 5 + gap * 4;
  const sel = (arm) => `.rating.${arm}[data-size="${size}"]`;
  return `
${sel("naive")}{width:${row}px;height:${star}px}
${sel("naive")} .track{position:relative;display:flex;gap:${gap}px;width:${row}px;height:${star}px}
${sel("naive")} .slot{flex:0 0 ${star}px;height:${star}px}
${sel("shifted")},${sel("shifted-slots")}{position:relative;width:${row}px;height:${star}px}
${sel("shifted")} .track,${sel("shifted-slots")} .track{position:absolute;top:0;bottom:0;left:${-(slot / 2 + gap / 2)}px;width:${slot * 5}px;box-sizing:border-box;padding-left:${slot / 2}px;display:flex}
${sel("shifted")} .slot,${sel("shifted-slots")} .slot{flex:0 0 ${slot}px;display:flex;align-items:center;justify-content:center}
${sel("shifted-slots")} .track{pointer-events:none}
${sel("shifted-slots")} .slot{pointer-events:auto}
.rating[data-size="${size}"] .star{width:${star}px;height:${star}px}`;
};

const STYLE = `
.p1{margin:16px;display:flex;gap:12px;align-items:center}
.steplist{display:flex;gap:24px;list-style:none;margin:0;padding:0}
.step{display:flex;gap:6px;align-items:center;cursor:default;outline-offset:2px}
.step[data-focus-visible]{outline:2px solid #3b63fb}
.step .visual{width:16px;height:16px;border-radius:50%;background:#8f8f8f;color:#fff;font-size:10px;display:flex;align-items:center;justify-content:center}
li[data-state="completed"] .visual{background:#505050}
li[data-state="current"] .visual{background:#292929}
.step[data-disabled]{color:#c6c6c6}
.p2{margin:16px 48px;display:flex;gap:48px;align-items:center;flex-wrap:wrap}
.p2 > div{display:flex;flex-direction:column;gap:8px}
.rating{display:block;padding:7px 0;touch-action:none}
.rating .star{display:block;background:#c6c6c6;clip-path:polygon(50% 0,61% 35%,98% 35%,68% 57%,79% 91%,50% 70%,21% 91%,32% 57%,2% 35%,39% 35%)}
.rating .star[data-filled]{background:#292929}
.rating .thumb{width:1px;height:1px;top:50%;pointer-events:none}
.rating:has([data-focus-visible]){outline:2px solid #3b63fb;outline-offset:2px;border-radius:8px}
.odd{display:block;width:120px}
.oddtrack{position:relative;height:12px;background:#ddd}
.oddtrack .react-aria-SliderThumb{width:8px;height:12px;top:50%;background:#292929}
${Object.entries(SIZES)
  .map(([size, dims]) => armCss(size, dims))
  .join("\n")}`;

const STEP_LABELS = ["정보 입력", "배송지", "결제", "확인", "완료"];
const steps = STEP_LABELS.map((label, index) => ({
  key: `s${index + 1}`,
  label,
}));

/** 대조할 단계 fixture — 기준값은 실행 스크립트의 정답표와 v3 hook 을 그대로 그린 대조 목록이다. */
export const STEP_FIXTURES = [
  { id: "A", steps, selectedKey: "s3", lastCompletedStep: "s2" },
  {
    id: "B",
    steps,
    selectedKey: "s4",
    lastCompletedStep: "s3",
    disabledKeys: ["s2"],
  },
  { id: "C", steps, selectedKey: "s3", lastCompletedStep: "s3" },
  { id: "D", steps },
];

export const RATING_ARMS = ["naive", "shifted", "shifted-slots"];

function App() {
  useEffect(() => {
    window.__ready = true;
  }, []);
  return h(
    "div",
    null,
    h("style", null, STYLE),
    STEP_FIXTURES.map((fixture) => h(StepList, { key: fixture.id, fixture })),
    h(
      "div",
      { className: "p2" },
      RATING_ARMS.flatMap((arm) =>
        Object.keys(SIZES).map((size) =>
          h(
            "div",
            { key: `${arm}-${size}` },
            `${arm} ${size}`,
            h(Rating, { id: `${arm}-${size}`, arm, size }),
          ),
        ),
      ),
    ),
    h(
      "div",
      { className: "p2" },
      [2.5, 6, -1].flatMap((given) =>
        ["controlled", "uncontrolled"].map((mode) =>
          h(
            "div",
            { key: `${given}-${mode}` },
            `${given} ${mode}`,
            h(OddSlider, { id: `${given}-${mode}`, given, mode }),
          ),
        ),
      ),
      h(
        "div",
        null,
        "Meter 2.5 (valueLabel 없음)",
        h(Meter, {
          value: 2.5,
          minValue: 0,
          maxValue: 5,
          "aria-label": "평균 평점",
          "data-meter": "plain",
        }),
      ),
      h(
        "div",
        null,
        "Meter 2.5 (valueLabel)",
        h(Meter, {
          value: 2.5,
          minValue: 0,
          maxValue: 5,
          valueLabel: "5점 만점에 2.5점",
          "aria-label": "평균 평점",
          "data-meter": "labelled",
        }),
      ),
    ),
  );
}

export function mount() {
  const host = document.createElement("div");
  document.body.append(host);
  createRoot(host).render(h(App));
}
