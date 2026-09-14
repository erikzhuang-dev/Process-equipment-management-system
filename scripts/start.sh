#!/bin/bash
set -Eeuo pipefail

COZE_WORKSPACE_PATH="${COZE_WORKSPACE_PATH:-$(pwd)}"

PORT=5000
DEPLOY_RUN_PORT="${DEPLOY_RUN_PORT:-$PORT}"

# 数据库就绪自愈（迁移自旧 start-prod.sh）：有本地 MariaDB 自动引导；
# 仅有外部 DATABASE_URL 则直接对其迁移；都没有则仅告警，应用仍启动。
if [ "${SKIP_DB:-}" = "1" ]; then
  echo "[start] SKIP_DB=1, skip database bootstrap"
elif command -v mysqladmin >/dev/null 2>&1; then
  bash "${COZE_WORKSPACE_PATH}/scripts/ensure-db.sh"
  (cd "${COZE_WORKSPACE_PATH}" && pnpm run db:push) || echo "[start] WARN: db:push failed" >&2
  bash "${COZE_WORKSPACE_PATH}/scripts/ensure-seed.sh"
elif [ -n "${DATABASE_URL:-}" ]; then
  echo "[start] DATABASE_URL provided, running migrations against it"
  (cd "${COZE_WORKSPACE_PATH}" && pnpm run db:push) || echo "[start] WARN: db:push failed" >&2
else
  echo "[start] WARN: no mysqladmin and no DATABASE_URL; DB APIs will report unavailable" >&2
fi


start_service() {
    cd "${COZE_WORKSPACE_PATH}"
    echo "Starting HTTP service on port ${DEPLOY_RUN_PORT} for deploy..."
    PORT=${DEPLOY_RUN_PORT} node dist/server.js
}

echo "Starting HTTP service on port ${DEPLOY_RUN_PORT} for deploy..."
start_service
