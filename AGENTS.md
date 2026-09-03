# AGENTS.md

## 项目概览
生产工艺设备管理信息系统（Process Equipment Management System），设备台账 / 保养计划与工单 / 故障维修 / 备件库存 / 用户权限与操作日志的一体化管理平台，支持中英双语与 Excel 导入导出。

- 源自：https://github.com/erikzhuang-dev/Process-equipment-management-system
- 技术栈：React 19 + Vite 7 + TypeScript 5 + Tailwind CSS 4 + shadcn/ui 风格组件 + wouter（路由）+ tRPC 11 + React Query 5 + Express 4 + Drizzle ORM + MySQL(MariaDB) + Vitest

## 目录结构
```
client/            前端源码（Vite root）
  src/pages/       页面组件（仪表盘、台账、保养、维修、备件、权限日志等）
  src/_core/       前端基础设施（tRPC 客户端、auth hook、路由 shell）
  src/components/  通用组件与 ui 组件库
server/            后端源码
  _core/           Express 启动、tRPC 上下文、OAuth/SDK、存储代理、LLM 等平台集成
  db.ts            全部数据库读写函数（业务数据访问唯一入口）
  routers.ts       tRPC 路由聚合（业务路由在此）
  domainRules.ts   领域规则（状态流转、库存、保养周期）
  persistence*.ts  持久化写入集与执行器
drizzle/           schema.ts（MySQL 方言定义）+ 迁移 SQL（drizzle-kit 管理）
shared/            前后端共享常量/类型（@shared 别名）
scripts/           数据库与启动脚本（ensure-db.sh / start-dev.sh / start-prod.sh）
```

## 常用命令
- 开发：`coze dev`（等价 `.coze [dev]`：pnpm install -> bash scripts/start-dev.sh）
- 生产构建：`pnpm run build`（vite build + esbuild 打包 server）
- 生产启动：`pnpm run start`（node dist/index.js，或 `coze start`）
- 类型检查：`pnpm run check`（tsc --noEmit）
- 单元测试：`pnpm run test`（vitest run）
- 数据库迁移：`pnpm run db:push`（drizzle-kit generate && migrate；需 DATABASE_URL）
- 数据库就绪（幂等）：`bash scripts/ensure-db.sh`

## 运行环境要点
- 服务端口：读取 `DEPLOY_RUN_PORT`（默认 5000），见 server/_core/index.ts 的 PORT 逻辑
- 数据库：本地 MariaDB，库名 pems，账号 pems/pems_local_2024（见 scripts/ensure-db.sh），连接串在根目录 `.env` 的 `DATABASE_URL`
- 认证：原项目使用 Manus OAuth（OAUTH_SERVER_URL）。本地无 OAuth 时，tRPC 上下文自动回退为"公共管理员工作站"（openId=public-admin-workstation, role=admin），见 server/_core/context.ts 的 getPublicAdministrator 兜底，功能完整可用
- 环境变量通过根目录 `.env` 注入（server 端 dotenv/config；Vite envDir 指向根目录）

## 代码风格与约定
- 全 TypeScript ESM（"type": "module"）， prettier 格式化（`pnpm run format`）
- 路径别名：`@` -> client/src，`@shared` -> shared
- 业务数据读写一律经由 server/db.ts 的函数；新增表先改 drizzle/schema.ts，再 `pnpm run db:push` 生成迁移
- tRPC 路由在 server/routers.ts 注册；前端通过 client/src/_core 的 trpc 客户端 + React Query 调用
- Excel 导入导出使用中文列名（见 使用说明.md 的字段表）
- 测试文件 `*.test.ts` 与被测代码同目录，使用 vitest

## 注意事项
- 严禁使用 npm/yarn，仅用 pnpm
- 端口 9000 为系统保留
- 生产部署环境无 MariaDB 时需自行提供 DATABASE_URL，否则接口报"数据库连接不可用"
