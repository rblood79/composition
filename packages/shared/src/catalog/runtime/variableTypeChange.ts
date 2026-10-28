/**
 * ADR-288 (사용자 결정 1, 2026-10-28) — one rule for a variable's default when its type changes,
 * the same for a project variable and a page · element variable: a value that fits the new type
 * stays (converted — `"42"` → `42`, `"true"` → `true`, `3` → `"3"`), one that does not is emptied.
 *
 * "Empty" is the owner's contract: a page · element variable (`StateVariableEntry`) holds a
 * scalar (`""` · `0` · `false`; `object` · `array` are always `""` — contract 51, a rule fills
 * them), a project variable (`ProjectVariableEntry`) has no default (`undefined` — the runtime
 * reads the type's zero value). Structured defaults (JSON) are the project's only.
 */
export type VariableValueType =
  "string" | "number" | "boolean" | "object" | "array";

/** Whose default: `state` = page · element (scalar contract), `project` = project variable. */
export type VariableDefaultOwner = "state" | "project";

function emptyFor(type: VariableValueType, owner: VariableDefaultOwner) {
  if (owner === "project") return undefined;
  return type === "number" ? 0 : type === "boolean" ? false : "";
}

/** The default a variable keeps after its type becomes `type` — kept when it fits, else empty. */
export function variableDefaultForType(
  type: VariableValueType,
  value: unknown,
  owner: VariableDefaultOwner,
): unknown {
  const empty = emptyFor(type, owner);
  if (value === undefined || value === null) return empty;
  switch (type) {
    case "string":
      if (typeof value === "string") return value;
      if (typeof value === "number" || typeof value === "boolean")
        return String(value);
      return empty;
    case "number": {
      if (typeof value === "number")
        return Number.isFinite(value) ? value : empty;
      if (typeof value !== "string") return empty;
      const text = value.trim();
      if (text === "") return empty;
      const n = Number(text);
      return Number.isFinite(n) ? n : empty;
    }
    case "boolean": {
      if (typeof value === "boolean") return value;
      if (typeof value !== "string") return empty;
      const text = value.trim().toLowerCase();
      return text === "true" ? true : text === "false" ? false : empty;
    }
    case "object":
      if (owner === "state") return "";
      return typeof value === "object" && !Array.isArray(value) ? value : empty;
    case "array":
      if (owner === "state") return "";
      return Array.isArray(value) ? value : empty;
  }
}
