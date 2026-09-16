/**
 * Users & Auth — 기존 4 preset 을 규칙으로 옮겼다 (키 · 타입 · 기본 개수 유지).
 * Users 는 randomuser 어법으로 성별 ↔ 이름 ↔ 초상 일관 (`gender` · `avatar` 컬럼 추가).
 */

import { definePreset, type DataTablePreset } from "../types";
import { col, idCol } from "./column";

export const users: DataTablePreset = definePreset({
  id: "users",
  name: "Users",
  descriptionKey: "presetMeta.users",
  category: "users-auth",
  icon: "User",
  defaultSampleCount: 10,
  columns: [
    idCol({ kind: "id", prefix: "usr_" }),
    col("num", "number", "num", { kind: "rowNumber" }),
    col("gender", "string", "gender", { kind: "gender" }),
    col(
      "name",
      "string",
      "name",
      { kind: "fullName", genderKey: "gender" },
      {
        required: true,
      },
    ),
    col(
      "email",
      "email",
      "email",
      {
        kind: "formula",
        compute: ({ index, mock }) =>
          `user${index + 1}@${mock.internet.domain()}`,
      },
      { required: true },
    ),
    col("phone", "string", "phone", { kind: "cell" }),
    col("avatar", "image", "avatar", {
      kind: "avatar",
      genderKey: "gender",
      size: "thumbnail",
    }),
    col("company", "string", "company", { kind: "company" }),
    col("role", "string", "jobTitle", { kind: "jobTitle" }),
    col("status", "string", "status", {
      kind: "weightedPool",
      name: "userStatuses",
      weights: [7, 1, 1, 1],
    }),
    col("jobLevel", "string", "jobLevel", { kind: "jobLevel" }),
    col("createdAt", "datetime", "createdAt", { kind: "pastDate", years: 2 }),
  ],
});

export const roles: DataTablePreset = definePreset({
  id: "roles",
  name: "Roles",
  descriptionKey: "presetMeta.roles",
  category: "users-auth",
  icon: "Key",
  defaultSampleCount: 5,
  columns: [
    idCol({ kind: "id", prefix: "role_" }),
    col(
      "name",
      "string",
      "roleName",
      { kind: "pool", name: "roleNames", selection: "sequential" },
      {
        required: true,
      },
    ),
    col("description", "string", "description", {
      kind: "pool",
      name: "roleDescriptions",
      selection: "sequential",
    }),
    col("scope", "string", "scope", {
      kind: "enum",
      values: ["global", "project"],
    }),
    col("permissionIds", "array", "permissionList", {
      kind: "array",
      min: 2,
      max: 5,
      item: { kind: "id", prefix: "perm_" },
    }),
  ],
});

export const permissions: DataTablePreset = definePreset({
  id: "permissions",
  name: "Permissions",
  descriptionKey: "presetMeta.permissions",
  category: "users-auth",
  icon: "Lock",
  defaultSampleCount: 10,
  columns: [
    idCol({ kind: "id", prefix: "perm_" }),
    col(
      "name",
      "string",
      "permissionName",
      { kind: "pool", name: "permissionNames", selection: "sequential" },
      { required: true },
    ),
    col("description", "string", "description", {
      kind: "pool",
      name: "permissionDescriptions",
      selection: "sequential",
    }),
    col("category", "string", "category", {
      kind: "enum",
      values: ["user", "project", "organization", "security", "billing"],
    }),
  ],
});

export const invitations: DataTablePreset = definePreset({
  id: "invitations",
  name: "Invitations",
  descriptionKey: "presetMeta.invitations",
  category: "users-auth",
  icon: "Mail",
  defaultSampleCount: 5,
  columns: [
    idCol({ kind: "id", prefix: "inv_" }),
    col(
      "email",
      "email",
      "email",
      {
        kind: "formula",
        compute: ({ index }) => `invited${index + 1}@example.com`,
      },
      { required: true },
    ),
    col("roleId", "string", "roleId", { kind: "id", prefix: "role_" }),
    col("inviterUserId", "string", "inviterId", { kind: "id", prefix: "usr_" }),
    col("status", "string", "status", {
      kind: "weighted",
      options: [
        { value: "pending", weight: 5 },
        { value: "accepted", weight: 3 },
        { value: "expired", weight: 1 },
        { value: "revoked", weight: 1 },
      ],
    }),
    col("expiresAt", "datetime", "expiresAt", { kind: "futureDate", days: 30 }),
    col("createdAt", "datetime", "createdAt", { kind: "pastDate", years: 1 }),
  ],
});

export const USERS_AUTH_PRESETS = { users, roles, permissions, invitations };
