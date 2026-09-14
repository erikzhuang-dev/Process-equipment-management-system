# AGENTS.md

## 项目概览
生产工艺设备管理信息系统（Process Equipment Management System），设备台账 / 保养计划与工单 / 故障维修 / 备件库存 / 用户权限与操作日志的一体化管理平台，支持中英双语与 Excel 导入导出。

- 技术栈：Next.js 16（App Router）+ React 19 + TypeScript 5 + Tailwind CSS 4 + shadcn/ui 风格组件 + wouter（客户端路由）+ tRPC 11（fetch adapter）+ React Query 5 + Drizzle ORM + MySQL(MariaDB) + Vitest
- 架构：**客户端渲染平移**（策略 A）——单 catch-all 页 `src/app/[[...slug]]/page.tsx`（`"use client"` + `dynamic(..., { ssr: false })`），内部沿用 wouter Switch，URL 与页面刷新行为与原 Vite 版完全一致；后端以 Next Route Handlers 承载原 Express API。

## 目录结构
```
src/                     前端源码（tsconfig @/* 别名）
  app/
    layout.tsx           根布局（globals.css）
    providers.tsx        tRPC client + React Query Provider
    [[...slug]]/page.tsx 单 catch-all 页：ssr:false 动态加载 App（wouter 路由）
    api/trpc/[trpc]/route.ts   tRPC fetchRequestHandler（GET/POST）
    api/uploads/route.ts       POST 图片上传（base64 → public/uploads，≤5MB 白名单）
    api/health/route.ts        健康诊断（数据库连通性、连接串脱敏）
  pages/                 页面组件（Home 多视图、EquipmentDetail）
  components/            通用组件 + ui/（shadcn 全套 53 个）
  contexts/              LanguageContext / ThemeContext / languageCopy
  lib/                   业务纯函数（equipmentDetail/excel/inlineEditorState...）+ trpc.ts
  _core/hooks/           useAuth（trpc useUtils 封装）
  const.ts               OAuth 相关常量（NEXT_PUBLIC_* 环境变量）
server/                  后端源码（@server/* 别名）
  _core/
    context.ts           tRPC fetch 版 createContext（sdk.authenticateRequest(headers)）
    sdk.ts               平台 SDK（会话 cookie / Bearer 校验、OAuth 用户同步）
    trpc.ts              initTRPC 实例（superjson）、public/admin procedure
    systemRouter.ts      tRPC system.health
    notification.ts      平台通知（notifyOwner）
    env.ts               环境变量聚合（ENV）
  db.ts                  全部数据库读写函数（业务数据访问唯一入口；DATABASE_URL 缺失时回退默认连接串）
  routers.ts             tRPC 路由聚合（equipment/maintenance/repairs/parts/auth/dashboard/permissions...）
  authorization.ts       角色权限断言（assertAdminRole）
  domainRules.ts         领域规则（状态流转、库存、保养周期）
  persistence*.ts        持久化写入集与执行器
drizzle/                 schema.ts（MySQL 方言）+ 迁移 SQL（drizzle-kit 管理）
shared/                  前后端共享常量/类型（@shared 别名）
scripts/                 dev.sh（dev 启动+DB 自愈）、build.sh、start.sh（生产+DB 自愈）、ensure-db.sh、seed.sql、ensure-seed.sh
```

## 常用命令
- 开发：`coze dev`（.coze [dev]：prepare.sh → dev.sh；dev.sh 内置端口清理 + ensure-db → db:push → ensure-seed → `next dev --webpack --port $DEPLOY_RUN_PORT`）
- 生产构建：`pnpm run build`（scripts/build.sh：next build --webpack + tsup 打包 src/server.ts → dist/server.js）
- 生产启动：`pnpm run start`（scripts/start.sh：DB 自愈 + `node dist/server.js`，或 `coze start`）
- 类型检查：`pnpm run ts-check`（tsc -p tsconfig.json）
- 单元测试：`pnpm run test`（vitest run；jsdom 用文件头 `// @vitest-environment jsdom` 声明）
- 数据库迁移：`pnpm run db:push`（drizzle-kit generate && migrate；需 DATABASE_URL）
- 数据库就绪（幂等）：`bash scripts/ensure-db.sh`

## 运行环境要点
- 服务端口：读取 `DEPLOY_RUN_PORT`（默认 5000），见 scripts/dev.sh / start.sh
- 数据库：本地 MariaDB，库名 pems，账号 pems/pems_local_2024（见 scripts/ensure-db.sh），连接串在根目录 `.env` 的 `DATABASE_URL`；缺失时 db.ts 回退默认连接串 `mysql://pems:pems_local_2024@127.0.0.1:3306/pems`
- 认证：原项目使用 Manus OAuth（OAUTH_SERVER_URL）。本地/发布环境无 OAuth 时，tRPC 上下文自动回退为"公共管理员工作站"（openId=public-admin-workstation, role=admin），见 server/_core/context.ts 的 getPublicAdministrator 兜底，功能完整可用
- 上传文件：写入 `public/uploads/`（Next public 目录直接静态托管，dev/prod 行为一致）
- 环境变量通过根目录 `.env` 注入；前端侧 `NEXT_PUBLIC_*` 由 Next 内联
- vitest 配置在根目录 `vitest.config.mts`（别名 @、@shared、@server）

## 代码风格与约定
- 全 TypeScript ESM，prettier 格式化
- 路径别名：`@` -> src，`@shared` -> shared，`@server` -> server
- 业务数据读写一律经由 server/db.ts 的函数；新增表先改 drizzle/schema.ts，再 `pnpm run db:push` 生成迁移
- tRPC 路由在 server/routers.ts 注册；前端通过 src/lib/trpc.ts 的 trpc 客户端 + React Query 调用（无需改 Route Handler）
- 新增 REST 端点放 `src/app/api/**/route.ts`；动态段参数为 `Promise<{...}>`（Next 16）
- 页面路由在 src/App.tsx 的 wouter Switch 中注册；无需新建 page 文件
- Excel 导入导出使用中文列名（见 使用说明.md 的字段表）
- 测试文件 `*.test.ts(x)` 与被测代码同目录（唯一例外：inlineEquipmentDetail.test.tsx 在 src/lib/，因 Next 将 src/pages/*.test 误认为 Pages Router 页面）

## 注意事项
- 严禁使用 npm/yarn，仅用 pnpm
- 端口 9000 为系统保留
- `logout` mutation 当前为 no-op（公共管理员兜底模式下无真实会话 cookie）；接入平台 OAuth 后在 Route Handler 层恢复 Set-Cookie 逻辑
- catch-all 页用 `dynamic(() => import("@/App"), { ssr: false })` 禁用 SSR——原应用为纯 CSR（依赖 window/localStorage），新增组件无需做 hydration 兼容
- src/pages/ 下不要放 `.test.tsx`（会被 Next 误认为 Pages Router 页面）
