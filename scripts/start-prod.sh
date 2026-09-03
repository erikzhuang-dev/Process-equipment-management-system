#!/usr/bin/env bash
# 生产环境启动脚本：确保数据库就绪 -> 应用迁移（幂等）-> 运行已构建产物
# 有本地 MariaDB：自动拉起并迁移；仅有外部 DATABASE_URL：直接对其迁移；
# 都没有：应用仍启动（DB 接口将报"数据库连接不可用"），可设 SKIP_DB=1 静默跳过。
set -euo pipefail
cd "$(dirname "$0")/.."

if [ "${SKIP_DB:-}" = "1" ]; then
  echo "[start-prod] SKIP_DB=1, skip database bootstrap"
elif command -v mysqladmin >/dev/null 2>&1; then
  bash scripts/ensure-db.sh
  pnpm run db:push || echo "[start-prod] WARN: db:push failed" >&2
elif [ -n "${DATABASE_URL:-}" ]; then
  echo "[start-prod] DATABASE_URL provided, running migrations against it"
  pnpm run db:push || echo "[start-prod] WARN: db:push failed" >&2
else
  echo "[start-prod] WARN: no mysqladmin and no DATABASE_URL; DB APIs will report unavailable" >&2
fi

export NODE_ENV=production
export PORT="${DEPLOY_RUN_PORT:-5000}"
exec node dist/index.js
