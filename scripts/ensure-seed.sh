#!/usr/bin/env bash
# 若业务数据为空则导入种子数据（幂等；必须在 db:push 迁移完成后执行）
# 用途：沙箱/容器重置导致数据库清空后自动恢复基础演示数据
set -u
cd "$(dirname "$0")/.."

DB_NAME="pems"
DB_USER="pems"
DB_PASS="pems_local_2024"
SEED_FILE="scripts/seed.sql"

[ -f "$SEED_FILE" ] || { echo "[ensure-seed] seed file missing, skip"; exit 0; }

# 仅在本地 MariaDB 可用时执行（外部 DATABASE_URL 环境由使用者自行导入）
if ! mysqladmin ping --silent 2>/dev/null; then
  echo "[ensure-seed] mariadb not reachable, skip"
  exit 0
fi

# 表未就绪（迁移未完成）时跳过，下次启动再补
if ! mysql -u"${DB_USER}" -p"${DB_PASS}" -e "SELECT 1 FROM \`${DB_NAME}\`.equipment LIMIT 1" >/dev/null 2>&1; then
  echo "[ensure-seed] equipment table not ready, skip"
  exit 0
fi

COUNT=$(mysql -u"${DB_USER}" -p"${DB_PASS}" -N -B -e "SELECT COUNT(*) FROM \`${DB_NAME}\`.equipment" 2>/dev/null || echo 0)
if [ "$COUNT" = "0" ]; then
  echo "[ensure-seed] equipment empty, importing seed data..."
  mysql -u"${DB_USER}" -p"${DB_PASS}" "${DB_NAME}" < "$SEED_FILE" \
    && echo "[ensure-seed] seed data imported"
else
  echo "[ensure-seed] data exists (${COUNT} equipment), skip"
fi
