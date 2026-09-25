/** ADR-202: 실제 catalog/command descriptor를 받는 host 중립 manifest와 semantic 검증. */
import { validateCommandArgs } from "./commandArgs";
import { programContract, type BuilderCommandProgram } from "./contracts";
import { isBodyType } from "@composition/shared";

export interface ManifestField {
  name: string;
  origin: "semantic" | "style";
  kind: string;
  values?: readonly string[];
  min?: number;
  max?: number;
}
export interface ManifestComponent {
  type: string;
  label: string;
  placeable: boolean;
  creationMode: "leaf" | "complex" | "reusable";
  props: readonly ManifestField[];
  reusableId?: string;
}
export interface ManifestCommand {
  id: string;
  description: string;
  confirm: boolean;
  args?: Record<string, unknown>;
}
export interface CommandManifest {
  components: readonly ManifestComponent[];
  commands: readonly ManifestCommand[];
}
export interface CommandContext {
  parentId: string | null;
  selectedId: string | null;
  nodes: readonly {
    id: string;
    type: string;
    componentType?: string;
    props?: readonly ManifestField[];
  }[];
}

function validateFields(
  patch: Record<string, unknown> | undefined,
  origin: ManifestField["origin"],
  fields: readonly ManifestField[],
): string | null {
  for (const [name, value] of Object.entries(patch ?? {})) {
    const field = fields.find((f) => f.name === name && f.origin === origin);
    if (!field) return `unknown-${origin}-field:${name}`;
    if (field.values && !field.values.includes(String(value)))
      return `invalid-enum:${name}`;
    if (field.kind === "boolean" && typeof value !== "boolean")
      return `invalid-boolean:${name}`;
    if (
      field.kind === "css" &&
      !(
        typeof value === "string" ||
        (typeof value === "number" && Number.isFinite(value))
      )
    )
      return `invalid-css-value:${name}`;
    if (field.kind === "number") {
      // CSS 크기 단위는 styleAdapter/레이아웃이 해석한다. 숫자가 아닌 자유 문자열은 제외.
      if (typeof value !== "number" || !Number.isFinite(value))
        return `invalid-number:${name}`;
      if (field.min !== undefined && value < field.min)
        return `below-min:${name}`;
      if (field.max !== undefined && value > field.max)
        return `above-max:${name}`;
    }
    if (
      ["string", "icon", "enum", "variant", "size", "fillStyle"].includes(
        field.kind,
      ) &&
      typeof value !== "string"
    )
      return `invalid-string:${name}`;
    if (
      field.kind === "string-array" &&
      (!Array.isArray(value) || !value.every((v) => typeof v === "string"))
    )
      return `invalid-array:${name}`;
    // 구조화 binding/items는 기존 데이터 dispatcher/에디터 계약을 써야 한다.
    if (
      ![
        "css",
        "boolean",
        "number",
        "string",
        "icon",
        "enum",
        "variant",
        "size",
        "fillStyle",
        "string-array",
      ].includes(field.kind)
    )
      return `unsupported-field:${name}`;
  }
  return null;
}

export function validateProgram(
  raw: unknown,
  manifest: CommandManifest,
  context: CommandContext,
): { ok: true; program: BuilderCommandProgram } | { ok: false; error: string } {
  const parsed = programContract.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "invalid-program" };
  const op = parsed.data.operations[0];
  if (op.op === "run_command") {
    const command = manifest.commands.find((c) => c.id === op.args.id);
    if (!command) return { ok: false, error: "unknown-command" };
    try {
      const argsSchema = {
        ...(command.args ?? { type: "object", properties: {} }),
        additionalProperties: false,
      };
      if (!validateCommandArgs(op.args.args ?? {}, argsSchema))
        return { ok: false, error: "invalid-command-args" };
    } catch {
      return { ok: false, error: "unsupported-command-schema" };
    }
    // confirm/precondition/dispatcher 정책을 이곳에서 재구현하지 않는다.
    return { ok: true, program: parsed.data };
  }
  const target =
    op.op === "create_element"
      ? null
      : context.nodes.find((n) => n.id === op.args.elementId);
  if (op.op !== "create_element" && !target)
    return { ok: false, error: "missing-target" };
  if (op.op === "delete_element") {
    if (isBodyType(target?.type))
      return { ok: false, error: "protected-target" };
    return { ok: true, program: parsed.data };
  }
  const type = op.op === "create_element" ? op.args.type : target!.type;
  const component = manifest.components.find((c) => c.type === type);
  if (op.op === "create_element") {
    if (!component?.placeable) return { ok: false, error: "not-placeable" };
    const parent = op.args.parentId ?? context.parentId;
    if (!parent || !context.nodes.some((n) => n.id === parent))
      return { ok: false, error: "missing-parent" };
  }
  const fields = target?.props ?? component?.props ?? [];
  const error =
    validateFields(op.args.props, "semantic", fields) ??
    validateFields(op.args.styles, "style", fields);
  if (error) return { ok: false, error };
  const slot = op.args.canonical?.slot;
  if (
    Array.isArray(slot) &&
    slot.some((id) => !manifest.components.some((c) => c.reusableId === id))
  )
    return { ok: false, error: "unknown-slot-component" };
  if (
    type !== "frame" &&
    (op.args.canonical?.clip !== undefined ||
      op.args.canonical?.placeholder !== undefined)
  )
    return { ok: false, error: "frame-only-field" };
  if (
    op.op === "update_element" &&
    !Object.keys(op.args.props ?? {}).length &&
    !Object.keys(op.args.styles ?? {}).length &&
    !Object.keys(op.args.canonical ?? {}).length &&
    op.args.fills === undefined
  )
    return { ok: false, error: "empty-update" };
  return { ok: true, program: parsed.data };
}
