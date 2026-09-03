#!/usr/bin/env bash
# 生产环境启动脚本：确保数据库就绪 -> 运行已构建产物
set -euo pipefail
cd "$(dirname "$0")/.."

bash scripts/ensure-db.sh

export NODE_ENV=production
export PORT="${DEPLOY_RUN_PORT:-5000}"
exec node dist/index.js
