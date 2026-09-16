/**
 * Organization · Manufacturing · System — 기존 preset 을 규칙으로 옮겼다 (키 · 타입 유지).
 * 카탈로그 문장 템플릿 (`presetData.departmentDescription` 등) 은 formula 가 `t` 로 읽는다.
 */

import { definePreset, type DataTablePreset } from "../types";
import { col, idCol } from "./column";

const DAY = 24 * 60 * 60 * 1000;

export const organizations: DataTablePreset = definePreset({
  id: "organizations",
  name: "Organizations",
  descriptionKey: "presetMeta.organizations",
  category: "organization",
  icon: "Building2",
  defaultSampleCount: 5,
  columns: [
    idCol({ kind: "id", prefix: "org_" }),
    col("name", "string", "orgName", { kind: "company" }, { required: true }),
    col("industry", "string", "industry", { kind: "industry" }),
    col("domain", "string", "domain", {
      kind: "formula",
      compute: ({ index }) => `company${index + 1}.com`,
    }),
    col("plan", "string", "plan", {
      kind: "weightedPool",
      name: "plans",
      weights: [5, 3, 1],
    }),
    col("createdAt", "datetime", "createdAt", { kind: "pastDate", years: 3 }),
  ],
});

export const departments: DataTablePreset = definePreset({
  id: "departments",
  name: "Departments",
  descriptionKey: "presetMeta.departments",
  category: "organization",
  icon: "Layers",
  defaultSampleCount: 8,
  columns: [
    idCol({ kind: "id", prefix: "dept_" }),
    col("organizationId", "string", "orgId", { kind: "id", prefix: "org_" }),
    col(
      "name",
      "string",
      "departmentName",
      { kind: "pool", name: "departments", selection: "sequential" },
      { required: true },
    ),
    col("description", "string", "description", {
      kind: "formula",
      compute: ({ row, t }) =>
        t("presetData.departmentDescription", { name: String(row.name ?? "") }),
    }),
    col("managerUserId", "string", "managerId", { kind: "id", prefix: "usr_" }),
  ],
});

export const projects: DataTablePreset = definePreset({
  id: "projects",
  name: "Projects",
  descriptionKey: "presetMeta.projects",
  category: "organization",
  icon: "Folder",
  defaultSampleCount: 10,
  columns: [
    idCol({ kind: "id", prefix: "proj_" }),
    col("organizationId", "string", "orgId", { kind: "id", prefix: "org_" }),
    col("departmentId", "string", "departmentId", {
      kind: "id",
      prefix: "dept_",
    }),
    col(
      "name",
      "string",
      "projectName",
      {
        kind: "formula",
        compute: ({ index, t }) =>
          t("presetData.projectName", { n: index + 1 }),
      },
      { required: true },
    ),
    col("status", "string", "status", {
      kind: "weightedPool",
      name: "projectStatuses",
      weights: [2, 5, 1, 2],
    }),
    col("startDate", "date", "startDate", {
      kind: "pastDate",
      years: 1,
      withTime: false,
    }),
    col("endDate", "date", "endDate", {
      kind: "formula",
      compute: ({ row, mock }) => {
        const start = Date.parse(String(row.startDate ?? ""));
        const base = Number.isNaN(start) ? Date.now() : start;
        return mock.date.iso(
          new Date(base + mock.random.int(30, 365) * DAY),
          false,
        );
      },
    }),
    col("budget", "number", "budget", {
      kind: "formula",
      compute: ({ mock }) => mock.random.int(1000, 50000) * 10000,
    }),
    col("clientName", "string", "client", { kind: "company" }),
    col("visibility", "string", "visibility", {
      kind: "weighted",
      options: [
        { value: "private", weight: 5 },
        { value: "internal", weight: 3 },
        { value: "public", weight: 1 },
      ],
    }),
  ],
});

export const engines: DataTablePreset = definePreset({
  id: "engines",
  name: "Engines",
  descriptionKey: "presetMeta.engines",
  category: "manufacturing",
  icon: "Cpu",
  defaultSampleCount: 5,
  columns: [
    idCol({ kind: "id", prefix: "eng_" }),
    col("projectId", "string", "projectId", { kind: "id", prefix: "proj_" }),
    col(
      "name",
      "string",
      "engineName",
      {
        kind: "formula",
        compute: ({ index, t }) => t("presetData.engineName", { n: index + 1 }),
      },
      { required: true },
    ),
    col("code", "string", "code", { kind: "sequence", prefix: "ENG-" }),
    col("version", "string", "version", {
      kind: "formula",
      compute: ({ mock }) =>
        `v${mock.random.int(1, 5)}.${mock.random.int(0, 9)}`,
    }),
    col("status", "string", "status", { kind: "pool", name: "engineStatuses" }),
    col("manufacturer", "string", "manufacturer", {
      kind: "pool",
      name: "manufacturers",
    }),
    col("specifications", "object", "specifications", {
      kind: "object",
      fields: [
        {
          key: "power",
          rule: {
            kind: "formula",
            compute: ({ mock }) => `${mock.random.int(50, 500)}kW`,
          },
        },
        {
          key: "weight",
          rule: {
            kind: "formula",
            compute: ({ mock }) => `${mock.random.int(100, 1000)}kg`,
          },
        },
        {
          key: "dimensions",
          rule: {
            kind: "formula",
            compute: ({ mock }) =>
              `${mock.random.int(50, 200)}x${mock.random.int(50, 200)}x${mock.random.int(50, 200)}cm`,
          },
        },
      ],
    }),
    col("createdAt", "datetime", "createdAt", { kind: "pastDate", years: 2 }),
  ],
});

export const components: DataTablePreset = definePreset({
  id: "components",
  name: "Components",
  descriptionKey: "presetMeta.components",
  category: "manufacturing",
  icon: "Wrench",
  defaultSampleCount: 20,
  columns: [
    idCol({ kind: "id", prefix: "comp_" }),
    col("engineId", "string", "engineId", { kind: "id", prefix: "eng_" }),
    col("parentId", "string", "parentPartId", {
      kind: "formula",
      compute: ({ index, mock }) =>
        index > 5 ? mock.string.id("comp_") : null,
    }),
    col(
      "name",
      "string",
      "partName",
      {
        kind: "formula",
        compute: ({ index, t }) => t("presetData.partName", { n: index + 1 }),
      },
      { required: true },
    ),
    col("code", "string", "partCode", { kind: "sequence", prefix: "COMP-" }),
    col("type", "string", "type", {
      kind: "weighted",
      options: [
        { value: "part", weight: 3 },
        { value: "assembly", weight: 1 },
      ],
    }),
    col("level", "number", "level", { kind: "int", min: 0, max: 5 }),
    col("quantity", "number", "quantity", { kind: "int", min: 1, max: 100 }),
    col("unit", "string", "unit", {
      kind: "enum",
      values: ["EA", "SET", "M", "KG", "L"],
    }),
    col("supplier", "string", "supplier", { kind: "pool", name: "suppliers" }),
    col("cost", "number", "cost", { kind: "int", min: 100, max: 10000 }),
    col("leadTime", "number", "leadTime", { kind: "int", min: 1, max: 30 }),
    col("status", "string", "status", {
      kind: "weightedPool",
      name: "partStatuses",
      weights: [6, 1, 2, 1],
    }),
  ],
});

export const auditLogs: DataTablePreset = definePreset({
  id: "auditLogs",
  name: "Audit Logs",
  descriptionKey: "presetMeta.auditLogs",
  category: "system",
  icon: "FileText",
  defaultSampleCount: 20,
  columns: [
    idCol({ kind: "id", prefix: "log_" }),
    col("actorUserId", "string", "actorId", { kind: "id", prefix: "usr_" }),
    col("organizationId", "string", "orgId", { kind: "id", prefix: "org_" }),
    col("entityType", "string", "entityType", {
      kind: "enum",
      values: ["user", "project", "organization", "department"],
    }),
    col("entityId", "string", "entityId", { kind: "id" }),
    col("action", "string", "action", {
      kind: "weightedPool",
      name: "auditActions",
      weights: [2, 4, 1, 1, 5],
    }),
    col("description", "string", "description", {
      kind: "formula",
      compute: ({ index, t }) =>
        t("presetData.auditDescription", { n: index + 1 }),
    }),
    col("timestamp", "datetime", "time", { kind: "pastDate", years: 1 }),
    col("ipAddress", "string", "ipAddress", { kind: "ipv4" }),
    col("userAgent", "string", "userAgent", { kind: "userAgent" }),
  ],
});

export const projectMemberships: DataTablePreset = definePreset({
  id: "projectMemberships",
  name: "Project Memberships",
  descriptionKey: "presetMeta.projectMembers",
  category: "system",
  icon: "Users",
  defaultSampleCount: 15,
  columns: [
    idCol({ kind: "id", prefix: "mem_" }),
    col("projectId", "string", "projectId", { kind: "id", prefix: "proj_" }),
    col("userId", "string", "userId", { kind: "id", prefix: "usr_" }),
    col("roleId", "string", "roleId", { kind: "id", prefix: "role_" }),
    col("allocation", "number", "allocation", {
      kind: "int",
      min: 10,
      max: 100,
    }),
    col("billable", "boolean", "billable", { kind: "boolean", trueRatio: 0.7 }),
    col("joinedAt", "datetime", "joinedAt", { kind: "pastDate", years: 2 }),
    col("lastActiveAt", "datetime", "lastActive", {
      kind: "pastDate",
      days: 180,
    }),
  ],
});

export const ORGANIZATION_PRESETS = { organizations, departments, projects };
export const MANUFACTURING_PRESETS = { engines, components };
export const SYSTEM_PRESETS = { auditLogs, projectMemberships };
