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

先复制一份环境变量模板：

```bash
cp .env.example .env
```

如果你在 Windows PowerShell 里执行，可以用：

```powershell
Copy-Item .env.example .env
```

??????????? `.env` ?????????????? `APP_URL`???????????????

???

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

### 1. 接口提示 API key 未填写

???????????????????????????????????????????????

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

如需服务端默认密钥，先编辑 `.env`，然后执行：

```bash
npm run dev
```
