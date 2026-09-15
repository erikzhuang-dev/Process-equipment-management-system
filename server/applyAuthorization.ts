/**
 * 申请域鉴权断言：基于 apply_users 两类角色（user 普通人员 / admin 管理人员）判断操作资格。
 */
import { TRPCError } from "@trpc/server";
import type { ApplyRoleKey } from "../shared/apply";

export interface ActingIdentity {
  id: number;
  name: string | null;
  roleKey: ApplyRoleKey;
}

export function requireIdentity(user: ActingIdentity | null | undefined): ActingIdentity {
  if (!user || !Number.isInteger(user.id) || user.id <= 0) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "请先在左下角选择操作身份" });
  }
  return user;
}

export function requireRole(user: ActingIdentity | null | undefined, roles: readonly ApplyRoleKey[]): ActingIdentity {
  const identity = requireIdentity(user);
  if (!roles.includes(identity.roleKey)) {
    throw new TRPCError({ code: "FORBIDDEN", message: `当前身份（${identity.roleKey}）无权执行该操作` });
  }
  return identity;
}

/** 管理人员身份断言（审批、执行推进、验收等管理动作） */
export function requireAdmin(user: ActingIdentity | null | undefined): ActingIdentity {
  return requireRole(user, ["admin"]);
}

/** 审批资格：管理人员即可审批（两类角色权限模型） */
export function requireNodeActor(input: { user: ActingIdentity | null | undefined }): ActingIdentity {
  return requireAdmin(input.user);
}

/** 申请人本人或管理人员可撤回 */
export function requireOwnerOrAdmin(input: { user: ActingIdentity | null | undefined; submitterId: number }): ActingIdentity {
  const identity = requireIdentity(input.user);
  if (identity.id !== input.submitterId && identity.roleKey !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "仅申请人本人或管理人员可撤回该申请" });
  }
  return identity;
}
