/**
 * 申请域鉴权断言：基于 apply_users 角色与单据节点判断操作资格。
 */
import { TRPCError } from "@trpc/server";
import { nodeRoleKey } from "./applyEngine";
import type { ApplyRoleKey, ApprovalNodeKey } from "../shared/apply";

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

/** 节点审批资格：角色匹配即可（设备主管/经理共用 manager 角色键） */
export function requireNodeActor(input: {
  user: ActingIdentity | null | undefined;
  node: ApprovalNodeKey;
}): ActingIdentity {
  const identity = requireIdentity(input.user);
  const required = nodeRoleKey(input.node);
  if (identity.roleKey !== required) {
    throw new TRPCError({ code: "FORBIDDEN", message: `该节点需要「${required}」身份审批，当前为「${identity.roleKey}」` });
  }
  return identity;
}

/** 申请人本人或系统管理员可撤回 */
export function requireOwnerOrAdmin(input: { user: ActingIdentity | null | undefined; submitterId: number }): ActingIdentity {
  const identity = requireIdentity(input.user);
  if (identity.id !== input.submitterId && identity.roleKey !== "system_admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "仅申请人本人或系统管理员可撤回该申请" });
  }
  return identity;
}
