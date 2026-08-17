export function assertAdminRole(role: "admin" | "user") {
  if (role !== "admin") {
    throw new Error("仅管理员可执行此操作");
  }
}
