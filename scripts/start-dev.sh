#!/usr/bin/env bash
# 开发环境启动脚本：确保数据库就绪 -> 应用迁移 -> 启动应用（Vite 中间件模式 + 热更新）
set -euo pipefail
cd "$(dirname "$0")/.."

bash scripts/ensure-db.sh

# 应用数据库迁移（幂等）
pnpm run db:push

# 迁移后导入种子数据（仅当业务表为空）
bash scripts/ensure-seed.sh

export NODE_ENV=development
export PORT="${DEPLOY_RUN_PORT:-5000}"
exec pnpm exec tsx watch --exclude ".manus-logs/**" --exclude "assets/**" --exclude "attached_assets/**" --exclude "public/**" --exclude "drizzle/**" --exclude "dist/**" --exclude "scripts/**" --exclude "client/**" --exclude "node_modules/**" --exclude "dist-public/**" server/_core/index.ts
