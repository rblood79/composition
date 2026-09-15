/** ADR-202 — exact alias만 direct로 분류한다. 부분 문자열/부정문 추측은 하지 않는다. */
import { commandRecipes } from "./recipes";
import { FillType } from "../../../types/builder/fill.types";
import type {
  BuilderCommandOperation,
  BuilderCommandProgram,
} from "./contracts";
import type { CommandContext, CommandManifest } from "./manifest";

// alias는 새 identity가 아니다. 정본 type/command가 없으면 아래 alias도 노출되지 않는다.
const typeAliases: Readonly<Record<string, readonly string[]>> = {
  Button: ["버튼"],
  Text: ["텍스트", "문자"],
  Select: ["선택 상자", "셀렉트"],
  Card: ["카드"],
  Form: ["폼"],
  Table: ["테이블", "표"],
  TextField: ["텍스트 필드", "입력 필드"],
  Checkbox: ["체크박스"],
  frame: ["프레임"],
};
const commandAliases: Readonly<Record<string, readonly string[]>> = {
  zoomIn: ["캔버스 확대", "캔버스를 확대해", "확대해", "zoom in"],
  zoomOut: ["캔버스 축소", "캔버스를 축소해", "축소해", "zoom out"],
  undo: ["실행 취소", "되돌려", "undo"],
  redo: ["다시 실행", "redo"],
  alignLeft: ["왼쪽 정렬해", "align left"],
  alignHCenter: ["가운데 정렬해", "align center"],
};

export type CompileResult =
  | { route: "direct"; program: BuilderCommandProgram }
  | { route: "ambiguous" | "creative-multistep"; reason: string };

export function normalizeRequest(message: string): string {
  return message
    .normalize("NFKC")
    .trim()
    .replace(/[.!。]+$/, "")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

export function compileRequest(
  message: string,
  manifest: CommandManifest,
  context: CommandContext,
): CompileResult {
  const text = normalizeRequest(message);
  const program = (op: BuilderCommandOperation): CompileResult => ({
    route: "direct",
    program: { version: 1, source: "compiler", operations: [op] },
  });
  if (!text || /하지\s*마|말고|아니|않|don't|do not|not\b|instead/.test(text))
    return { route: "ambiguous", reason: "negative-or-empty" };
  if (
    /화면.*분석.*디자인|전체.*디자인|redesign.*(page|screen)|design.*dashboard/.test(
      text,
    )
  )
    return { route: "creative-multistep", reason: "iterative-design" };
  const commands = manifest.commands.filter((c) =>
    [normalizeRequest(c.id), ...(commandAliases[c.id] ?? [])].includes(text),
  );
  if (commands.length === 1)
    return program({ op: "run_command", args: { id: commands[0].id } });
  if (
    /^(선택한 요소 삭제|선택한 요소 삭제해|delete selection)$/.test(text) &&
    context.selectedId
  )
    return program({
      op: "delete_element",
      args: { elementId: context.selectedId },
    });
  const colorMatch =
    /^(?:선택한 (?:요소|버튼|카드)(?:을|를)?\s*|set selection (?:to )?)(파란색|빨간색|초록색|blue|red|green)(?:으로)?$/.exec(
      text,
    );
  if (colorMatch && context.selectedId) {
    const target = context.nodes.find((node) => node.id === context.selectedId);
    if (
      (text.includes("버튼") && target?.type !== "Button") ||
      (text.includes("카드") &&
        target?.type !== "Card" &&
        target?.componentType !== "Card")
    )
      return { route: "ambiguous", reason: "target-type-mismatch" };
    const colors: Record<string, string> = {
      파란색: "#0000FFFF",
      blue: "#0000FFFF",
      빨간색: "#FF0000FF",
      red: "#FF0000FF",
      초록색: "#008000FF",
      green: "#008000FF",
    };
    return program({
      op: "update_element",
      args: {
        elementId: context.selectedId,
        fills: [
          {
            type: FillType.Color,
            color: colors[colorMatch[1]],
            enabled: true,
            opacity: 1,
            blendMode: "normal",
            id: "compiler-color",
          },
        ],
      },
    });
  }
  // 명시 key/value만 해석하며 허용 여부는 같은 manifest validator가 판정한다.
  const edit = /^set ([a-z][a-z0-9]*) to (.+)$/i.exec(
    message.normalize("NFKC").trim(),
  );
  if (edit && context.selectedId) {
    const target = context.nodes.find((n) => n.id === context.selectedId);
    const fields =
      target?.props ??
      manifest.components.find((c) => c.type === target?.type)?.props ??
      [];
    const matchingFields = fields.filter(
      (f) => f.name.toLowerCase() === edit[1].toLowerCase(),
    );
    const field = matchingFields.length === 1 ? matchingFields[0] : undefined;
    if (field) {
      const raw = edit[2];
      const value =
        field.kind === "number"
          ? Number(raw)
          : field.kind === "boolean" && /^(true|false)$/.test(raw)
            ? raw === "true"
            : raw.replace(/^"(.*)"$/, "$1");
      return program({
        op: "update_element",
        args: {
          elementId: context.selectedId,
          [field.origin === "style" ? "styles" : "props"]: {
            [field.name]: value,
          },
        },
      });
    }
  }
  // 목적어 전체가 단일 등록 type/alias인 생성 문장만 허용한다.
  const creation =
    /^(?:create|add) (?:an? )?(.+)$/.exec(text) ??
    /^(.+?)(?:을|를)?\s*(?:생성해|생성해줘|생성|추가해|추가해줘|추가|만들어|만들어줘)$/.exec(
      text,
    );
  if (creation) {
    const noun = creation[1].trim();
    const recipe = commandRecipes.find((r) =>
      r.aliases.some((alias) => normalizeRequest(alias) === noun),
    );
    const recipeOp = recipe?.operation;
    if (
      recipeOp?.op === "create_element" &&
      context.parentId &&
      manifest.components.some(
        (c) => c.type === recipeOp.args.type && c.placeable,
      )
    ) {
      return program({
        op: "create_element",
        args: { ...recipeOp.args, parentId: context.parentId },
      });
    }
    const candidates = manifest.components.filter(
      (c) =>
        c.placeable &&
        [c.type, c.label, ...(typeAliases[c.type] ?? [])].some(
          (alias) => normalizeRequest(alias) === noun,
        ),
    );
    if (candidates.length === 1 && context.parentId)
      return program({
        op: "create_element",
        args: { type: candidates[0].type, parentId: context.parentId },
      });
  }
  return { route: "ambiguous", reason: "no-exact-capability" };
}
