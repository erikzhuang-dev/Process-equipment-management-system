export function assertAdminRole(role: "admin" | "user") {
  if (role !== "admin") {
    throw new Error("仅管理员可执行此操作");
  }
}

export function assertOwnerRoleIsRetained(input: { targetOpenId: string; ownerOpenId: string; nextRole: "admin" | "user" }) {
  if (input.targetOpenId === input.ownerOpenId && input.nextRole !== "admin") {
    throw new Error("项目所有者必须保留管理员角色");
  }
}
