#!/usr/bin/env bash
# 确保 MariaDB 已启动、应用数据库与账号就绪（幂等，可重复执行）
set -u

DB_NAME="pems"
DB_USER="pems"
DB_PASS="pems_local_2024"

# 1. 启动 MariaDB（如未运行）
if ! mysqladmin ping --silent 2>/dev/null; then
  echo "[ensure-db] starting mariadb..."
  mkdir -p /run/mysqld
  chown -R mysql:mysql /run/mysqld 2>/dev/null || true
  if [ ! -d /var/lib/mysql/mysql ]; then
    mysql_install_db --user=mysql --datadir=/var/lib/mysql >/dev/null 2>&1 || true
  fi
  nohup mysqld_safe >/tmp/mysqld-safe.log 2>&1 &
  for i in $(seq 1 30); do
    if mysqladmin ping --silent 2>/dev/null; then break; fi
    sleep 1
  done
  mysqladmin ping --silent || { echo "[ensure-db] mariadb failed to start"; exit 1; }
fi
echo "[ensure-db] mariadb is alive"

# 2. 确保数据库与账号存在
mysql <<SQL
CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASS}';
GRANT ALL PRIVILEGES ON \`${DB_NAME}\`.* TO '${DB_USER}'@'localhost';
FLUSH PRIVILEGES;
SQL
echo "[ensure-db] database '${DB_NAME}' and user ready"
