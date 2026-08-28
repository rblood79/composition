/**
 * ADR-134 G5 측정 — 동적 주입 정확도 (15 시나리오).
 *
 * **무엇을 재는가**: 사용자가 실제로 던지는 요청에서, 그 요청을 수행하는 데 필요한
 * 컴포넌트와 props / 허용 값이 주입된 문맥 안에 실제로 들어가는가 (recall).
 *
 * **왜 이 측정이 순환이 아닌가**: 기대값 (`needs`) 은 카탈로그를 보고 적은 것이 아니라
 * 요청 자체에서 나온 것이고, 각 항목이 진짜인지는 **`resolveEditContract` (D2 편집 계약
 * SSOT)** 로 먼저 검증한다 — 존재하지 않는 prop/값을 기대값으로 적으면 그 자리에서 실패한다.
 * 그 뒤에 재는 것은 카탈로그의 내용이 아니라 **선택기가 그것을 골라 넣었는가** 다.
 *
 * 모델을 루프에 넣은 정확도 (executor 프로파일로 실제 생성) 는 구성된 BYOK 프로파일이
 * 필요해 G6 (Phase 7 폐쇄망 실측) 에서 함께 측정한다.
 */
import { describe, expect, it } from "vitest";
import { resolveEditContract, type ComponentTag } from "@composition/shared";
import { buildCatalogSection } from "./dynamicInjection";

interface Need {
  type: string;
  /** 이 요청을 수행하려면 알아야 하는 props. */
  props?: string[];
  /** props 중 값까지 알아야 하는 것 (enum/variant/size). */
  values?: Record<string, string>;
}

interface Scenario {
  id: string;
  request: string;
  selectedType?: string;
  needs: Need[];
}

const SCENARIOS: readonly Scenario[] = [
  {
    id: "s1",
    request: "로그인 폼 만들어줘 — 아이디 입력창이랑 버튼",
    needs: [
      { type: "TextField", props: ["label", "isRequired"] },
      { type: "Button", props: ["children", "variant"] },
    ],
  },
  {
    id: "s2",
    request: "이 버튼 secondary 로 바꿔줘",
    selectedType: "Button",
    needs: [{ type: "Button", props: ["variant"], values: { variant: "secondary" } }],
  },
  {
    id: "s3",
    request: "버튼을 제일 크게 만들어줘",
    selectedType: "Button",
    needs: [{ type: "Button", props: ["size"], values: { size: "xl" } }],
  },
  {
    id: "s4",
    request: "상품 목록을 표로 보여줘",
    needs: [{ type: "Table", props: ["selectionMode"] }],
  },
  {
    // 컴포넌트 이름을 대지 않는다 — 목적만 말한다
    id: "s5",
    request: "약관에 동의했는지 받아야 해",
    needs: [{ type: "Checkbox", props: ["children", "isSelected"] }],
  },
  {
    id: "s6",
    request: "날짜 선택기 넣어줘",
    needs: [{ type: "DatePicker", props: ["label"] }],
  },
  {
    id: "s7",
    request: "슬라이더 추가해줘",
    needs: [{ type: "Slider", props: ["minValue", "maxValue"] }],
  },
  {
    // 별칭 사전에 없는 구어체 표기
    id: "s8",
    request: "화면을 탭으로 나눠서 전환하게 해줘",
    needs: [{ type: "Tabs", props: ["orientation"] }],
  },
  {
    id: "s9",
    request: "이 버튼 비활성으로 바꿔",
    selectedType: "Button",
    needs: [{ type: "Button", props: ["isDisabled"] }],
  },
  {
    id: "s10",
    request: "버튼을 outline 스타일로",
    selectedType: "Button",
    needs: [
      { type: "Button", props: ["fillStyle"], values: { fillStyle: "outline" } },
    ],
  },
  {
    // 목록에서 하나 고르게 — 이름 대신 동작으로
    id: "s11",
    request: "국가를 하나 고르게 하고 싶어",
    needs: [{ type: "Select", props: ["label"] }],
  },
  {
    // 영문 혼용 요청
    id: "s12",
    request: "업로드 progress bar 를 하나 넣자",
    needs: [{ type: "ProgressBar", props: ["value"] }],
  },
  {
    id: "s13",
    request: "스위치로 켜고 끄게 해줘",
    needs: [{ type: "Switch", props: ["isSelected"] }],
  },
  {
    id: "s14",
    request: "프레임 안에 텍스트 넣어줘",
    needs: [{ type: "frame" }, { type: "Text", props: ["children"] }],
  },
  {
    // 예산 압박 — 한 요청이 여러 컴포넌트를 부른다 (상한 12)
    id: "s15",
    request:
      "대시보드 만들어줘: 상단에 툴바, 표 하나, 태그 목록, 진행률, 그리고 저장 버튼",
    needs: [
      { type: "Table", props: ["selectionMode"] },
      { type: "TagGroup" },
      { type: "ProgressBar", props: ["value"] },
      { type: "Button", props: ["variant"] },
    ],
  },
];

/** 기대값이 실제 편집 계약에 존재하는지 — 데이터셋 자체의 무결성. */
function assertNeedIsReal(need: Need) {
  const contract = resolveEditContract(
    { id: `__scenario__${need.type}`, type: need.type as ComponentTag, props: {} },
    null,
  );
  const fields = new Map(contract.fields.map((f) => [f.key, f]));

  for (const prop of need.props ?? []) {
    expect(fields.has(prop), `${need.type}.${prop} 이 편집 계약에 없다`).toBe(
      true,
    );
  }
  for (const [prop, value] of Object.entries(need.values ?? {})) {
    const allowed = fields.get(prop)?.options?.map((o) => o.value) ?? [];
    expect(allowed, `${need.type}.${prop}`).toContain(value);
  }
}

describe("주입 시나리오 데이터셋 무결성", () => {
  it.each(SCENARIOS.map((s) => [s.id, s] as const))(
    "%s 의 기대값이 SSOT 편집 계약에 실재한다",
    (_id, scenario) => {
      for (const need of scenario.needs) assertNeedIsReal(need);
    },
  );
});

describe("G5 — 동적 주입 정확도 ≥ 90%", () => {
  it("15 시나리오의 필요 항목이 주입 문맥에 들어간다", () => {
    let total = 0;
    let hit = 0;
    const misses: string[] = [];

    for (const scenario of SCENARIOS) {
      const section = buildCatalogSection({
        request: scenario.request,
        selectedType: scenario.selectedType,
      });

      for (const need of scenario.needs) {
        // ① 컴포넌트 상세가 펼쳐졌는가
        total++;
        if (section.includes(`### ${need.type}`)) hit++;
        else misses.push(`${scenario.id}: ${need.type} 상세 미주입`);

        // ② props 이름이 들어갔는가
        for (const prop of need.props ?? []) {
          total++;
          if (section.includes(`- ${prop}:`)) hit++;
          else misses.push(`${scenario.id}: ${need.type}.${prop} 미주입`);
        }

        // ③ 값까지 알아야 하는 것은 값이 들어갔는가
        for (const [prop, value] of Object.entries(need.values ?? {})) {
          total++;
          const line = section
            .split("\n")
            .find((l) => l.startsWith(`- ${prop}:`));
          if (line?.includes(value)) hit++;
          else misses.push(`${scenario.id}: ${need.type}.${prop}=${value} 미주입`);
        }
      }
    }

    const recall = hit / total;
    // 실패 시 무엇이 빠졌는지 그대로 보이도록 미스 목록을 함께 단언한다
    // 2026-08-28 실측 45/45. 이 데이터셋은 실패할 수 있다 — "progress bar" (띄어쓰기)
    // 미매칭을 실제로 잡아냈고, 그 수정 뒤에 1.0 이 됐다.
    expect({ hit, total }).toEqual({ hit: 45, total: 45 });
    expect(recall, `misses: ${misses.join(" / ")}`).toBeGreaterThanOrEqual(0.9);
  });
});
