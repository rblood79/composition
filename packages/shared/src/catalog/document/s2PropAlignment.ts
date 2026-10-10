import type {
  AuthoredValue,
  CatalogEntry,
  CatalogLibrary,
  DefinitionId,
  LibraryDefinitionId,
  LibraryTemplateId,
  PropWrites,
} from "./types";

/**
 * S2 1.8.0 강조 · quiet 축 (2026-10-10 — 조사 §4.2 B): 공개 prop 은 boolean (`isEmphasized` ·
 * `isQuiet`) 이고, rule 의 이 이름 변형이 켜지는 모양이다. resolver 가 내부 `variant`
 * (binding 의 `editorHidden` 운반 값) 를 파생하므로 Canvas (rule paint) 와 DOM (`data-*` ·
 * 생성 CSS) 은 종전 record 그대로 읽는다 — 두 consumer 의 코드 변경 0.
 */
export const CATALOG_BOOLEAN_VARIANTS: Readonly<
  Record<string, { readonly prop: string; readonly variant: string }>
> = {
  Checkbox: { prop: "isEmphasized", variant: "emphasized" },
  Switch: { prop: "isEmphasized", variant: "emphasized" },
  Radio: { prop: "isEmphasized", variant: "emphasized" },
  Tree: { prop: "isEmphasized", variant: "emphasized" },
  // 2026-06-15 의 역전환: isQuiet boolean → variant "quiet" 흡수를 S2 표면 (isQuiet) 으로 되돌린다.
  TableView: { prop: "isQuiet", variant: "quiet" },
};

/**
 * S2 toggle 강조 context (`CheckboxGroup.tsx` `CheckboxContext` · RadioGroup 의 `FormContext`):
 * 그룹 안의 toggle 은 **그룹의** `isEmphasized` 를 쓴다 — S2 는 그룹 값이 toggle 자신의 prop 을
 * 이긴다 (`isInCheckboxGroup ? ctx?.isEmphasized : props.isEmphasized`). Radio 는 S2 에서 공개
 * prop 이 없는 context 전용 값이라 그룹으로만 켜진다. resolver `applyOwnerEmphasis`.
 */
export const CATALOG_EMPHASIS_FROM_GROUP: Readonly<Record<string, string>> = {
  Checkbox: "CheckboxGroup",
  Radio: "RadioGroup",
};

type PropValueMigration = (
  value: AuthoredValue,
) => Readonly<Record<string, AuthoredValue>>;

/** 전환 결과 "축 삭제" — 대체 write 없음. */
const DROP: Readonly<Record<string, AuthoredValue>> = {};

const emphasizedOf: PropValueMigration = (value) => {
  if (value === "emphasized") return { isEmphasized: true };
  return DROP;
};

/** 그룹 · Tree 의 옛 accent 변형 — S2 의 강조. */
const accentOf: PropValueMigration = (value) => {
  if (value === "accent") return { isEmphasized: true };
  return DROP;
};

const dropOf: PropValueMigration = () => DROP;

/** TableView 의 옛 quiet 변형 — S2 의 isQuiet. */
const quietOf: PropValueMigration = (value) => {
  if (value === "quiet") return { isQuiet: true };
  return DROP;
};

/**
 * 로드 시 1회 전환 (사용자 결정 2026-10-10): 옛 문서의 S2 이전 prop 을 S2 표면으로 바꾼다.
 * type → 옛 prop → 새 값들 ({} = 축 삭제). `createCatalogGraph` 가 적용하므로 storage 로드 ·
 * import · publish · preview snapshot 이 한 길로 지난다 — 저장은 다음 변경의 autosave 가 한다.
 */
export const CATALOG_S2_PROP_MIGRATIONS: Readonly<
  Record<string, Readonly<Record<string, PropValueMigration>>>
> = {
  Checkbox: { variant: emphasizedOf },
  Switch: { variant: emphasizedOf },
  CheckboxGroup: { variant: accentOf },
  RadioGroup: { variant: accentOf },
  // Radio 의 강조는 S2 에서 그룹의 것 (context 전용) — per-Radio variant (accent · neutral ·
  // negative) 는 S2 에 없는 축이라 삭제. Form 의 outlined 도 S2 에 없다 (Form 은 isEmphasized
  // 를 자식 field 에 전달하는 context 소유자).
  Radio: { variant: dropOf },
  Form: { variant: dropOf },
  Tree: { variant: accentOf },
  TableView: { variant: quietOf },
};

type MutablePropWrites = Record<string, PropWrites[string]>;

function migrateWrites(
  writes: MutablePropWrites | undefined,
  rules: Readonly<Record<string, PropValueMigration>>,
): boolean {
  if (!writes) return false;
  let changed = false;
  for (const [key, migrate] of Object.entries(rules)) {
    const write = writes[key];
    if (!write) continue;
    delete writes[key];
    changed = true;
    if (write.kind !== "set") continue;
    for (const [nextKey, nextValue] of Object.entries(migrate(write.value)))
      // (작성된 새 형식 값이 있으면 그것이 이긴다 — 전환은 빈 자리만 채운다.)
      writes[nextKey] ??= { kind: "set", value: nextValue };
  }
  return changed;
}

/**
 * 옛 문서의 entry 들을 제자리에서 전환한다. type 판정은 **라이브러리 정의 이름**만 쓴다 —
 * 문서 정의 (사용자 원본) 는 이름이 사용자 소유라 표와 우연히 겹칠 수 있어 건너뛴다 (그 안의
 * stale `variant` 값은 `resolveCatalogVariantName` 의 기본 변형 폴백이 받는다).
 */
export function migrateCatalogEntriesS2(
  entries: Record<string, CatalogEntry>,
  library: CatalogLibrary,
): boolean {
  const rulesOf = (definitionId: DefinitionId | undefined) => {
    if (
      definitionId === undefined ||
      !definitionId.startsWith("lib:definition:")
    )
      return undefined;
    const name = library.definitions.get(
      definitionId as LibraryDefinitionId,
    )?.name;
    return name ? CATALOG_S2_PROP_MIGRATIONS[name] : undefined;
  };
  let changed = false;
  for (const entry of Object.values(entries)) {
    if (entry.kind === "node") {
      const rules = rulesOf(entry.definitionId);
      if (rules)
        changed =
          migrateWrites(entry.props as MutablePropWrites, rules) || changed;
      for (const override of entry.descendantOverrides)
        if (override.kind === "patch" && override.props) {
          const target = override.address.templatePath.at(-1);
          const targetRules =
            typeof target === "string" && target.startsWith("lib:template:")
              ? rulesOf(
                  library.templates.get(target as LibraryTemplateId)
                    ?.definitionId,
                )
              : undefined;
          if (targetRules)
            changed =
              migrateWrites(override.props as MutablePropWrites, targetRules) ||
              changed;
        }
    } else if (entry.kind === "definitionOverride") {
      const rules = rulesOf(entry.targetId);
      if (rules)
        changed =
          migrateWrites(entry.defaults as MutablePropWrites, rules) || changed;
    }
  }
  return changed;
}
