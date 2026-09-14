#!/usr/bin/env bash
# 兼容 shim：沙箱预览守护进程缓存了旧的启动命令 start-dev.sh。
# Next.js 迁移后统一入口为 scripts/dev.sh，此文件保持旧命令可用。
set -euo pipefail
exec bash "$(dirname "$0")/dev.sh"
