/**
 * ADR-313 Decision 7 · G4 — 생성 방법 「Schema」: OpenAPI (springdoc `api-docs`) · JSON Schema 문서를 붙여넣거나
 * 놓으면 (네트워크 0 — HC1) 스키마를 고르고, 행 배열 경로 (포장 · 페이지) 를 고르고, 열 표 (타입 · 값 표현 ·
 * key — `ColumnIntakeTable`) 를 정한다. 가져오지 않은 구성 · 저장하지 않는 제약은 「Not imported」 에 전부
 * 보인다. 응답 스키마면 endpoint 정의 초안도 같이 만든다 (사용자 결정 2 — 정의만, 실행하지 않는다).
 * 가져오기 모듈은 이 방법을 고를 때 lazy 로 읽는다.
 */
import { useEffect, useMemo, useState } from "react";
import { Button } from "react-aria-components/Button";
import { DropZone } from "react-aria-components/DropZone";
import { isFileDropItem } from "react-aria-components/useDrop";
import { FileTrigger } from "react-aria-components/FileTrigger";
import { TextArea } from "react-aria-components/TextArea";
import { FileUp } from "lucide-react";
import { Section } from "../../../components/panel/Section";
import { PropertyFieldset } from "../../../components/property/PropertyFieldset";
import { PropertySelect } from "../../../components/property/PropertySelect";
import { PropertySwitch } from "../../../components/property/PropertySwitch";
import type { DataField } from "../../../../types/builder/data.types";
import { applyColumnChoice, columnsToSchema } from "../utils/columnDetector";
import type { ColumnChoice } from "../utils/encodingChoices";
import { ColumnIntakeTable } from "./ColumnIntakeTable";
import type {
  EndpointDraftInput,
  SchemaDocument,
} from "../schemaImport/schemaImport";

type SchemaImportModule = typeof import("../schemaImport/schemaImport");
type Translate = (
  key: string,
  params?: Record<string, string | number>,
) => string;

/** 만들 것 — 필드 (id 없음 · key 필드는 열 key) · endpoint 초안. */
export interface SchemaImportDraft {
  schema: DataField[];
  keyColumn: string | null;
  endpoint?: EndpointDraftInput;
}

export function SchemaImportSection({
  dt,
  tableName,
  onDraft,
}: {
  dt: Translate;
  tableName: string;
  onDraft: (draft: SchemaImportDraft | null) => void;
}) {
  const [module, setModule] = useState<SchemaImportModule | null>(null);
  useEffect(() => {
    let live = true;
    void import("../schemaImport/schemaImport").then((loaded) => {
      if (live) setModule(loaded);
    });
    return () => {
      live = false;
    };
  }, []);
  const [text, setText] = useState("");
  const read = useMemo(
    () => (module && text.trim() ? module.readSchemaDocument(text) : null),
    [module, text],
  );
  const doc: SchemaDocument | null = read && !("error" in read) ? read : null;
  const [choiceId, setChoiceId] = useState("");
  const choice = doc?.choices.find((c) => c.id === choiceId) ?? doc?.choices[0];
  const rowChoices = useMemo(
    () =>
      module && doc && choice ? module.rowPathChoices(doc, choice.node) : [],
    [module, doc, choice],
  );
  const [rowPath, setRowPath] = useState<string | null>(null);
  const rows = rowChoices.find((r) => r.path === rowPath) ?? rowChoices[0];
  const columns = useMemo(
    () => (module && doc && rows ? module.schemaColumns(doc, rows.item) : null),
    [module, doc, rows],
  );
  const [choices, setChoices] = useState<Record<string, ColumnChoice>>({});
  const [keyColumn, setKeyColumn] = useState<string | null>(null);
  const [withEndpoint, setWithEndpoint] = useState(true);
  // (A new schema · row path starts its choices fresh — the key is the first key candidate.)
  const [choicesOf, setChoicesOf] = useState(columns);
  if (choicesOf !== columns) {
    setChoicesOf(columns);
    setChoices({});
    setKeyColumn(columns?.columns.find((c) => c.keyCandidate)?.key ?? null);
  }

  const draft = useMemo((): SchemaImportDraft | null => {
    if (!module || !doc || !choice || !rows || !columns?.columns.length)
      return null;
    const schema = columnsToSchema(
      columns.columns.map((column) =>
        applyColumnChoice(column, choices[column.key]),
      ),
    ).map((field) => ({ ...field, ...columns.extras[field.key] }));
    const endpoint = withEndpoint
      ? module.endpointDraftOf(
          doc,
          choice,
          rows,
          tableName.trim() || choice.label,
        )
      : undefined;
    return { schema, keyColumn, ...(endpoint ? { endpoint } : {}) };
  }, [
    module,
    doc,
    choice,
    rows,
    columns,
    choices,
    keyColumn,
    withEndpoint,
    tableName,
  ]);
  useEffect(() => onDraft(draft), [draft, onDraft]);

  const error = read && "error" in read ? read.error : null;
  return (
    <>
      <Section
        id="creator-schema"
        title={dt("methodSchema")}
        collapsible={false}
      >
        <DropZone
          className="creator-dropzone"
          aria-label={dt("schemaDrop")}
          getDropOperation={() => "copy"}
          onDrop={async (event) => {
            const item = event.items.find(isFileDropItem);
            if (item) setText(await (await item.getFile()).text());
          }}
        >
          <FileTrigger
            acceptedFileTypes={[".json", "application/json"]}
            onSelect={(files) => {
              const file = files?.[0];
              if (file) void file.text().then(setText);
            }}
          >
            <Button className="creator-dropzone__button">
              <FileUp size={20} />
              <span>{dt("schemaDrop")}</span>
            </Button>
          </FileTrigger>
        </DropZone>
        <PropertyFieldset
          legend={dt("schemaPaste")}
          className="creator-paste-field"
        >
          <TextArea
            className="react-aria-TextArea"
            value={text}
            onChange={(event) => setText(event.target.value)}
            rows={4}
            aria-label={dt("schemaPaste")}
            spellCheck={false}
          />
        </PropertyFieldset>
        {error ? (
          <p className="creator-form-hint" role="note">
            {dt(error === "not-json" ? "schemaNotJson" : "schemaNotSchema")}
          </p>
        ) : null}
        {doc && choice ? (
          <div className="fieldset-row" data-wide>
            <PropertySelect
              className="creator-schema-pick"
              label={dt("schemaPick")}
              value={choice.id}
              optionValueMode="literal"
              translateOptions={false}
              options={doc.choices.map((c) => ({
                value: c.id,
                label: c.label,
              }))}
              onChange={(value) => {
                setChoiceId(value);
                setRowPath(null);
              }}
            />
          </div>
        ) : null}
        {rowChoices.length > 1 && rows ? (
          <div className="fieldset-row" data-wide>
            <PropertySelect
              className="creator-schema-rows"
              label={dt("schemaRows")}
              value={rows.path}
              optionValueMode="literal"
              translateOptions={false}
              options={rowChoices.map((r) => ({
                value: r.path,
                label: r.path === "" ? dt("schemaRowsWhole") : r.path,
              }))}
              onChange={setRowPath}
            />
          </div>
        ) : null}
        {choice?.operation ? (
          <div className="fieldset-row" data-wide>
            <PropertySwitch
              className="creator-schema-endpoint"
              label={dt("schemaEndpoint")}
              isSelected={withEndpoint}
              onChange={setWithEndpoint}
            />
          </div>
        ) : null}
      </Section>
      {columns && columns.columns.length ? (
        <Section
          id="schema-preview"
          title={dt("schemaPreview", { fields: columns.columns.length })}
          collapsible={false}
        >
          <ColumnIntakeTable
            detected={columns.columns}
            choices={choices}
            onChoice={(key, next) =>
              setChoices((current) => ({ ...current, [key]: next }))
            }
            keyColumn={keyColumn}
            onKeyColumn={setKeyColumn}
            dt={dt}
          />
        </Section>
      ) : null}
      {columns && (columns.report.length || columns.numericNames.length) ? (
        <Section
          id="schema-report"
          title={dt("schemaNotImported", { count: columns.report.length })}
          defaultExpanded={false}
        >
          <ul className="creator-schema-report">
            {columns.report.map((item) => (
              <li key={`${item.kind}:${item.path}:${item.name}`}>
                <code>{item.path || "/"}</code>{" "}
                {dt(
                  item.kind === "construct"
                    ? "schemaReportConstruct"
                    : "schemaReportConstraint",
                  {
                    name: item.name,
                  },
                )}
              </li>
            ))}
            {columns.numericNames.length ? (
              <li>
                {dt("schemaNumericNames", {
                  names: columns.numericNames.join(", "),
                })}
              </li>
            ) : null}
          </ul>
        </Section>
      ) : null}
    </>
  );
}
