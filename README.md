# AI Studio 项目运行说明

这个项目是一个基于 `Vite + React + Express + TypeScript` 的应用。

## 在别的电脑上拉取代码后，如何正常运行

### 1. 准备运行环境

请先安装下面的软件：

- `Node.js`，建议使用 Node 20 或更高版本
- `npm`，安装 Node.js 后通常会自带

可先在终端确认版本：

```bash
node -v
npm -v
```

### 2. 拉取代码

```bash
git clone <你的仓库地址>
cd aistudio
```

如果你已经把代码拷贝到本地，只需要进入项目目录即可：

```bash
cd aistudio
```

### 3. 安装依赖

项目当前使用 `npm` 和 `package-lock.json`，所以建议直接执行：

```bash
npm install
```

### 4. 配置环境变量

项目启动前必须配置 Gemini API Key。

先复制一份环境变量模板：

```bash
cp .env.example .env
```

如果你在 Windows PowerShell 里执行，可以用：

```powershell
Copy-Item .env.example .env
```

然后编辑项目根目录下的 `.env` 文件，至少需要填写：

```env
GEMINI_API_KEY="你的 Gemini API Key"
```

说明：

- `GEMINI_API_KEY`：必填，不填的话后端接口无法调用 Gemini
- `APP_URL`：本地开发时可以先不改，通常不是必须

注意：这个项目当前实际读取的是根目录下的 `.env` 文件，不是 `.env.local`。

### 5. 启动开发环境

```bash
npm run dev
```

启动成功后，终端会看到类似输出：

```bash
VITE v6.x ready
Local:   http://localhost:3000/
Server running on http://localhost:3001
```

- `http://localhost:3000` 鐢ㄤ簬 Vite 鍓嶇寮€鍙?
- `http://localhost:3001` 鐢ㄤ簬 Express API
- 娴忚鍣ㄤ腑鐨?`/api` 鍜?`/dev-api` 璇锋眰浼氬厛缁忚繃 `vite.config.ts` 浠ｇ悊

然后在浏览器打开：

[http://localhost:3000](http://localhost:3000)

## 生产模式运行

如果你想在新电脑上以构建后的方式运行，可以执行：

```bash
npm run build
npm run start
```

说明：

- `npm run build`：构建前端资源，并打包服务端代码到 `dist/`
- `npm run start`：启动构建后的服务

## 常用命令

```bash
npm run dev
npm run build
npm run start
npm run test
npm run lint
```

## 常见问题

### 1. 启动时报 `GEMINI_API_KEY environment variable is required`

说明你还没有正确配置 `.env` 文件。

请检查：

- 项目根目录下是否存在 `.env`
- `.env` 里是否已填写正确的 `GEMINI_API_KEY`

### 2. 执行 `npm install` 失败

可以按下面顺序排查：

1. 确认 Node.js 版本不要过低
2. 删除 `node_modules` 和 `package-lock.json` 后重新安装
3. 检查网络或 npm 镜像源是否可用

### 3. 浏览器打不开页面

请确认：

- 终端里已经出现 `Server running on http://localhost:3000`
- 本机的 `3000` 端口没有被其他程序占用

## 给同事/新电脑的最简步骤

如果只是想快速跑起来，按下面顺序执行即可：

```bash
npm install
cp .env.example .env
```

把 `.env` 里的 `GEMINI_API_KEY` 改好后，再执行：

```bash
npm run dev
```
