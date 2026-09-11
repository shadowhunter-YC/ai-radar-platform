#!/usr/bin/env bash
set -e

# ==============================================================================
# AI 情报雷达平台 (ai-radar-platform) NAS 部署脚本
# ==============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}======================================================${NC}"
echo -e "${BLUE}     AI 情报雷达平台 (ai-radar-platform) NAS 部署工具    ${NC}"
echo -e "${BLUE}======================================================${NC}"

usage() {
  echo ""
  echo "用法: $0 [pack | ssh | help]"
  echo ""
  echo "子命令说明:"
  echo "  pack                                打包生成 NAS 离线部署包 (ai-radar-deploy.tar.gz)"
  echo "  ssh <user@nas-ip> [remote-dir] [port]  通过 SSH 自动将部署包推送至 NAS 并启动 Docker"
  echo "  help                                显示此帮助信息"
  echo ""
  echo "示例:"
  echo "  $0 pack"
  echo "  $0 ssh admin@192.168.1.100 /volume1/docker/ai-radar 22"
  echo ""
}

# 1. 离线打包
pack_deploy() {
  echo -e "\n${YELLOW}▶ 正在生成 NAS 离线部署压缩包...${NC}"
  OUTPUT_FILE="${SCRIPT_DIR}/ai-radar-deploy.tar.gz"

  # 准备待打包文件列表
  FILES_TO_PACK=(
    "Dockerfile"
    ".dockerignore"
    "docker-compose.yml"
    ".env.production.example"
    "package.json"
    "package-lock.json"
    "next.config.mjs"
    "jsconfig.json"
    "app"
    "components"
    "lib"
    "db"
    "DEPLOY_NAS_GUIDE.md"
  )

  # 如果本地已存在 .env，也一并加入
  if [ -f ".env" ]; then
    FILES_TO_PACK+=(".env")
  fi

  # 检查必要文件
  for f in "${FILES_TO_PACK[@]}"; do
    if [ ! -e "$f" ]; then
      echo -e "${RED}错误: 缺少文件或目录: $f${NC}"
      exit 1
    fi
  done

  tar -czf "$OUTPUT_FILE" "${FILES_TO_PACK[@]}"
  
  SIZE=$(du -h "$OUTPUT_FILE" | awk '{print $1}')
  echo -e "${GREEN}✔ 打包完成!${NC}"
  echo -e "部署包路径: ${GREEN}${OUTPUT_FILE}${NC} (大小: ${SIZE})"
  echo -e "\n接下来您可以:"
  echo -e "  1. 打开 NAS 网页（如群晖 DSM File Station、威联通 File Station），将此压缩包上传到 docker 目录解压。"
  echo -e "  2. 或使用命令: ${YELLOW}$0 ssh <用户@NAS-IP> [目标目录]${NC} 自动上传并启动。"
}

# 2. SSH 远程推送部署
ssh_deploy() {
  REMOTE_TARGET="$1"
  REMOTE_DIR="${2:-/volume1/docker/ai-radar}"
  SSH_PORT="${3:-22}"

  if [ -z "$REMOTE_TARGET" ]; then
    echo -e "${RED}错误: 请指定 NAS 用户与 IP，例如: $0 ssh admin@192.168.1.100${NC}"
    usage
    exit 1
  fi

  pack_deploy

  echo -e "\n${YELLOW}▶ 正在连接 NAS (${REMOTE_TARGET}:${SSH_PORT}) 并创建远程目录: ${REMOTE_DIR} ...${NC}"
  ssh -p "$SSH_PORT" "$REMOTE_TARGET" "mkdir -p '${REMOTE_DIR}'"

  echo -e "\n${YELLOW}▶ 正在上传部署包至 NAS...${NC}"
  scp -P "$SSH_PORT" "${SCRIPT_DIR}/ai-radar-deploy.tar.gz" "${REMOTE_TARGET}:${REMOTE_DIR}/"

  echo -e "\n${YELLOW}▶ 正在 NAS 上解包并启动 Docker 容器...${NC}"
  ssh -p "$SSH_PORT" "$REMOTE_TARGET" << EOF
    cd "${REMOTE_DIR}"
    tar -xzf ai-radar-deploy.tar.gz
    if [ ! -f .env ]; then
      cp .env.production.example .env
      echo "已创建默认 .env 配置文件"
    fi
    echo "正在构建并启动容器 (轻量独立模式)..."
    docker compose up -d --build
    echo "检查容器运行状态:"
    docker compose ps
EOF

  echo -e "\n${GREEN}✔ 部署命令已成功执行!${NC}"
  echo -e "请在浏览器访问: ${GREEN}http://${REMOTE_TARGET#*@}:3100${NC}"
}

ACTION="${1:-pack}"

case "$ACTION" in
  pack)
    pack_deploy
    ;;
  ssh)
    ssh_deploy "$2" "$3" "$4"
    ;;
  help|--help|-h)
    usage
    ;;
  *)
    echo -e "${RED}未知命令: $ACTION${NC}"
    usage
    exit 1
    ;;
esac
