#!/usr/bin/env bash
# 开发环境启动脚本：确保数据库就绪 -> 应用迁移 -> 启动应用（Vite 中间件模式 + 热更新）
set -euo pipefail
cd "$(dirname "$0")/.."

bash scripts/ensure-db.sh

# 应用数据库迁移（幂等）
pnpm run db:push

export NODE_ENV=development
export PORT="${DEPLOY_RUN_PORT:-5000}"
exec pnpm exec tsx watch server/_core/index.ts
