# AI 情报雷达平台 NAS 部署全攻略

本指南介绍如何将 **AI 情报雷达平台 (ai-radar-platform)** 部署至您的家庭或企业 NAS（支持群晖 Synology DSM 7.x、威联通 QNAP QTS/QuTS hero、TrueNAS SCALE、unRAID 以及通用 Linux NAS）。

---

## 目录
1. [系统资源与特性](#系统资源与特性)
2. [部署准备与文件清单](#部署准备与文件清单)
3. [部署方式一：一键脚本自动化部署（推荐）](#部署方式一键脚本自动化部署推荐)
4. [部署方式二：群晖 Synology Container Manager 图形化部署](#部署方式二群晖-synology-container-manager-图形化部署)
5. [部署方式三：通用 Docker Compose 命令行部署](#部署方式三通用-docker-compose-命令行部署)
6. [环境变量与 AI 密钥配置](#环境变量与-ai-密钥配置)
7. [数据库模式选择（轻量 SQLite vs 完整 PostgreSQL）](#数据库模式选择轻量-sqlite-vs-完整-postgresql)
8. [常见问题排查与数据备份](#常见问题排查与数据备份)

---

## 系统资源与特性

- **架构优化**：采用 Next.js 15 独立瘦身镜像 (`standalone`) + Node.js 22 Alpine 底座。
- **超低资源占用**：
  - **内存消耗**：轻量独立模式仅需 **约 150MB 内存**，适合绝大多数 J3455/J4125/N5105/N100 及更高性能的 NAS。
  - **存储占用**：镜像约 180MB，运行数据持久化保存。
- **默认访问端口**：`3100`（可自由修改以避开其他服务）。
- **内置数据持久化**：情报草稿、已入库文章、AI 提取记录持久化保存在 NAS 的 `./data/collection.sqlite`。

---

## 部署准备与文件清单

项目根目录已为您生成所有必需的容器化配置文件：

| 文件 | 说明 |
| :--- | :--- |
| `Dockerfile` | 多阶段构建镜像定义（Node 22 + Next.js Standalone） |
| `docker-compose.yml` | 容器编排文件，包含端口映射、存储卷与可选 Postgres 服务 |
| `.env.production.example` | 生产环境变量模板 |
| `deploy-nas.sh` | 自动化打包与 SSH 远程部署脚本 |

---

## 部署方式一：一键脚本自动化部署（推荐）

如果您在 NAS 上开启了 SSH（群晖：控制面板 -> 终端机和 SNMP -> 启动 SSH 功能），可以在本地 Mac 终端直接运行：

### 1. 本地生成部署包
```bash
cd /Users/wilsonjwang/Lab/ai-radar-platform
./deploy-nas.sh pack
```
此命令将在项目根目录下生成 `ai-radar-deploy.tar.gz`（约几十 KB 代码包，构建镜像将在 NAS 上自动完成）。

### 2. 通过 SSH 一键推送并启动
```bash
./deploy-nas.sh ssh <用户名>@<NAS-IP> [目标目录] [SSH端口]

# 示例（群晖默认存放于 /volume1/docker/ai-radar）：
./deploy-nas.sh ssh admin@192.168.1.100 /volume1/docker/ai-radar 22
```
脚本将自动完成：
1. 在 NAS 上创建 `/volume1/docker/ai-radar` 目录
2. 上传部署包并解压
3. 生成默认 `.env`
4. 调用 NAS 的 `docker compose up -d --build` 构建并启动容器

启动后即可在浏览器访问：`http://<NAS-IP>:3100`

---

## 部署方式二：群晖 Synology Container Manager 图形化部署

如果更习惯使用群晖的 Web 界面管理容器：

1. **上传部署文件**：
   - 打开 DSM 的 **File Station**（文件总管）。
   - 在 `docker` 共享文件夹下新建子文件夹，命名为 `ai-radar`（即 `/volume1/docker/ai-radar`）。
   - 本地运行 `./deploy-nas.sh pack` 获得 `ai-radar-deploy.tar.gz`。
   - 将该压缩包上传到 NAS 的 `ai-radar` 文件夹并右键「解压到当前目录」。
   - 将解压出的 `.env.production.example` 重命名或复制为 `.env`。
   - 使用 DSM 文本编辑器打开 `.env`，填入您的 `SILICONFLOW_API_KEY`（硅基流动 API Key）。

2. **在 Container Manager 中创建项目**：
   - 打开 **Container Manager**。
   - 点击左侧 **项目 (Project)** -> 点击 **新增 (Create)**。
   - **项目名称**：`ai-radar`
   - **路径**：选择刚刚创建并解压的文件夹 `/docker/ai-radar`。
   - **来源**：选择「使用现有的 docker-compose.yml 创建项目」。
   - 点击「下一步」-> 保持默认 -> 点击「完成」。
   - Container Manager 将自动根据 Dockerfile 构建镜像并拉起容器。

3. **访问服务**：
   - 打开浏览器，访问 `http://<群晖IP>:3100` 即可进入 AI 情报雷达平台。

---

## 部署方式三：通用 Docker Compose 命令行部署

适用于 QNAP、TrueNAS、unRAID、Debian/Ubuntu/OMV：

1. 将项目文件同步到 NAS 上的目标文件夹（例如通过 SMB/NFS 挂载复制，或通过 `scp`）：
   ```bash
   scp ai-radar-deploy.tar.gz user@your-nas:/opt/docker/ai-radar/
   ```

2. SSH 登录 NAS 并进入目录：
   ```bash
   cd /opt/docker/ai-radar
   tar -xzf ai-radar-deploy.tar.gz
   cp .env.production.example .env
   ```

3. 编辑 `.env`（可配置端口、API Key 等）：
   ```bash
   nano .env
   ```

4. 构建并启动容器：
   ```bash
   docker compose up -d --build
   ```

5. 查看运行状态：
   ```bash
   docker compose ps
   docker compose logs -f ai-radar
   ```

---

## 环境变量与 AI 密钥配置

在 `.env` 中可自由调整以下参数：

```dotenv
# NAS 宿主机暴露的访问端口（默认 3100）
HOST_PORT=3100

# 硅基流动 API 密钥（用于 AI 新闻分析与定制日报提炼）
# 注册并申请 API Key：https://cloud.siliconflow.cn
SILICONFLOW_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxx

# 模型选择（默认预设 DeepSeek-V4-Pro，或更换为 DeepSeek-V3 等）
SILICONFLOW_MODEL=deepseek-ai/DeepSeek-V4-Pro
SILICONFLOW_BASE_URL=https://api.siliconflow.cn/v1

# 数据持久化目录（容器内部路径，无需修改）
COLLECTION_DATA_DIR=/app/data
```

> **提示**：修改 `.env` 后，在项目目录执行 `docker compose up -d` 即可热重载环境变量。

---

## 数据库模式选择（轻量 SQLite vs 完整 PostgreSQL）

### 模式 A：轻量独立模式（默认）
- **特点**：零外部依赖，极低内存，使用 Node 22 内置 SQLite。
- **启动**：直接运行 `docker compose up -d`。
- **持久化**：所有入库文章、草稿、爬取记录均保存在 `./data/collection.sqlite`。

### 模式 B：完整模式（PostgreSQL + SQLite）
- **特点**：附带官方 PostgreSQL 16 容器，自动执行 `db/schema.sql` 导入全球 AI 新闻源元数据与初始素材。
- **启动**：
  ```bash
  # 开启 postgres profile 启动两个容器
  docker compose --profile postgres up -d
  ```
- **配置**：在 `.env` 中取消注释：
  ```dotenv
  DATABASE_URL=postgres://postgres:postgres@postgres:5432/ai_radar
  ```

---

## 常见问题排查与数据备份

1. **端口冲突**：
   - 若 `3100` 端口已被 NAS 占用，修改 `.env` 中的 `HOST_PORT=3200`，再执行 `docker compose up -d`。

2. **外网/反向代理访问**：
   - 若您配置了群晖反向代理（Synology Reverse Proxy / Nginx Proxy Manager）或 Cloudflare Tunnel，将目标指向 `http://localhost:3100` 即可。

3. **数据备份**：
   - 定期备份 NAS 目录下的 `data/` 文件夹（包含 `collection.sqlite`），即可完整备份所有情报数据与历史记录。

4. **更新项目**：
   - 本地拉取 GitHub 最新代码后，再次运行 `./deploy-nas.sh pack`，上传解压后执行 `docker compose up -d --build` 即可完成无损热更新。
