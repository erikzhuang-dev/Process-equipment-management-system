"use client";

/**
 * 申请域身份上下文：当前"扮演"的申请域用户（角色），持久化到 localStorage。
 * 通过 httpBatchLink headers() 注入 X-Acting-User-Id；切换身份后失效全部查询。
 * 接入平台 OAuth 后：后端将以会话用户映射申请域身份，此切换器保留为"代录/演示"能力。
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { trpc } from "@/lib/trpc";
import { APPLY_ROLE_META, type ApplyRoleKey } from "@shared/apply";

export interface ActingIdentity {
  id: number;
  name: string;
  roleKey: ApplyRoleKey;
}

interface IdentityContextValue {
  current: ActingIdentity | null;
  users: ActingIdentity[];
  setCurrent: (identity: ActingIdentity) => void;
  isLoading: boolean;
  canApprove: boolean;
}

const IdentityContext = createContext<IdentityContextValue>({
  current: null,
  users: [],
  setCurrent: () => undefined,
  isLoading: false,
  canApprove: false,
});

export const ACTING_USER_STORAGE_KEY = "pems-acting-user";

export function readActingUserId(): string {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(ACTING_USER_STORAGE_KEY) ?? "";
}

export function roleLabel(roleKey: ApplyRoleKey, lang: "zh" | "en" = "zh"): string {
  const meta = APPLY_ROLE_META[roleKey];
  return lang === "zh" ? meta.nameZh : meta.nameEn;
}

export function IdentityProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [current, setCurrentState] = useState<ActingIdentity | null>(null);
  const [hydrated, setHydrated] = useState(false);

  const usersQuery = trpc.applications.identityUsers.useQuery(undefined, { staleTime: 60_000 });

  useEffect(() => {
    const raw = readActingUserId();
    if (raw) {
      const id = Number(raw);
      if (Number.isFinite(id)) {
        // 先标记占位，users 加载后回填完整身份
        setCurrentState({ id, name: "", roleKey: "user" });
      }
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    const users = usersQuery.data;
    if (!users?.length) return;
    setCurrentState(prev => {
      const match = prev ? users.find(user => user.id === prev.id) : undefined;
      if (match) return { id: match.id, name: match.name, roleKey: match.roleKey };
      // 未选身份时默认以"管理人员"进入（公共工作站演示形态）
      const admin = users.find(user => user.roleKey === "admin") ?? users[0];
      return { id: admin.id, name: admin.name, roleKey: admin.roleKey };
    });
  }, [usersQuery.data]);

  const setCurrent = useCallback(
    (identity: ActingIdentity) => {
      window.localStorage.setItem(ACTING_USER_STORAGE_KEY, String(identity.id));
      setCurrentState(identity);
      queryClient.invalidateQueries();
    },
    [queryClient]
  );

  const value = useMemo<IdentityContextValue>(
    () => ({
      current,
      users: (usersQuery.data ?? []).map(user => ({ id: user.id, name: user.name, roleKey: user.roleKey })),
      setCurrent,
      isLoading: usersQuery.isLoading || !hydrated,
      canApprove: current?.roleKey === "admin",
    }),
    [current, usersQuery.data, usersQuery.isLoading, setCurrent, hydrated]
  );

  return <IdentityContext.Provider value={value}>{children}</IdentityContext.Provider>;
}

export function useIdentity(): IdentityContextValue {
  return useContext(IdentityContext);
}
