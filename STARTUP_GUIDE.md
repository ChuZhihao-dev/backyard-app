# Backyard Designer Shopify App 启动说明

本文说明下次如何在 Windows PowerShell 中启动 Backyard Designer Shopify App。

## 环境要求

- Node.js 已安装
- Shopify CLI 已安装并可以执行 `shopify --version`
- 已拥有 Shopify Partner 账号
- 开发商店为 `function-613wh0ez.myshopify.com`
- 一个 PostgreSQL 数据库（见下方「配置数据库」）

## 配置数据库（PostgreSQL）

App 使用 PostgreSQL 存储会话、设计器商品和推荐组合，连接串通过环境变量 `DATABASE_URL` 提供。

### 方式一：免费的云数据库（推荐，免安装）

1. 打开 https://neon.com 注册（可用 GitHub 登录，免费额度足够开发）。
2. 新建一个 Project，复制它给出的 **Connection string**，形如：
   `postgresql://user:password@ep-xxx.aws.neon.tech/neondb?sslmode=require`
3. 在项目根目录创建 `.env` 文件（可从 `.env.example` 复制），把连接串填进去：

```env
DATABASE_URL="postgresql://user:password@ep-xxx.aws.neon.tech/neondb?sslmode=require"
```

> `shopify app dev` 会在 `.env` 里写入 `SHOPIFY_*` 变量，请保留已有的 `DATABASE_URL` 行。

### 方式二：本机 Docker

已安装 Docker Desktop 时，在项目根目录执行：

```powershell
docker compose up -d
```

然后把 `.env` 里的 `DATABASE_URL` 设置为：

```env
DATABASE_URL="postgresql://backyard:backyard@localhost:5432/backyard?schema=public"
```

### 首次初始化或迁移

设置好 `DATABASE_URL` 后，把表结构创建到数据库：

```powershell
npx prisma migrate deploy
```

`shopify app dev` 每次启动也会自动执行这一步，通常无需手动操作。需要可视化查看数据时运行 `npm run db:studio`。

## 正常启动

在 PowerShell 中执行：

```powershell
cd C:\Users\leo.chu\backyard-designer-app
shopify app dev --store function-613wh0ez.myshopify.com
```

启动成功后，终端会显示：

```text
Ready, watching for changes in your app
```

同时会显示本次临时生成的 App Proxy 地址和 Shopify 后台预览地址。`trycloudflare.com` 地址每次启动都可能变化，应以终端本次输出为准。

## 第一次启动或登录过期

如果终端提示：

```text
To run this command, log in to Shopify.
User verification code: XXXX-XXXX
```

1. 打开终端给出的 Shopify 授权链接。
2. 输入终端显示的验证码。
3. 完成登录和授权后，等待终端继续启动即可。

验证码具有时效性，只使用当前终端显示的验证码，不要复用旧验证码。

## 启动前检查 Prisma

开发命令会自动执行 `npx prisma generate`。如果看到以下错误：

```text
EPERM: operation not permitted, rename ...query_engine-windows.dll.node
```

通常是上一次 Node/Prisma 进程仍占用文件。按以下步骤处理：

1. 关闭其他正在运行的 Shopify App、React Router 或 Prisma 终端。
2. 在任务管理器中结束属于本项目的残留 `node.exe` 进程。
3. 重新生成 Prisma Client：

```powershell
cd C:\Users\leo.chu\backyard-designer-app
npx prisma generate
```

4. 再次执行正常启动命令。

不要在不确认进程归属的情况下结束所有 Node 进程，因为其他项目或编辑器服务也可能使用 Node。

## 常用地址

开发服务器启动后，以终端输出为准：

- Shopify App 后台预览：终端中的 `Preview URL`
- App Proxy：终端中的 `app_proxy | Using URL`
- GraphiQL：通常为 `http://localhost:3457/graphiql?...`
- 本地 React Router 服务：终端显示的 `Local` 地址

直接访问旧的 Cloudflare 地址可能失效，因为开发隧道会在重启后更换域名。

## 停止项目

在运行 Shopify CLI 的终端按：

```text
Ctrl + C
```

等待终端显示 `Shutting down dev` 后再关闭窗口。下次启动时重新执行正常启动命令即可。

## 代码修改后的验证

修改 App 代码后，保持 `shopify app dev` 运行，CLI 会自动监听并重新加载。需要单独构建时执行：

```powershell
npm run build
```

如果修改的是独立 Demo 项目 `C:\Users\leo.chu\backyard-3d-demo`，则进入该目录运行其 Vite 命令，不要在 Shopify App 目录中启动 Demo。构建完成后，回到 App 目录把产物同步进来（该命令会先清空旧的 `public/designer-demo`，避免遗留过期文件）：

```powershell
cd C:\Users\leo.chu\backyard-3d-demo
npm run build
cd C:\Users\leo.chu\backyard-designer-app
npm run sync:designer-demo
```

