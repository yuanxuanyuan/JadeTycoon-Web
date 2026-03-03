# 翡翠大亨 · 部署说明

将项目部署到网上，让别人通过手机或电脑访问网址游玩。

## 一、本地构建

```bash
npm install
npm run build
```

构建产物在 `dist/` 目录，为纯静态文件，可直接上传到任何静态托管服务。

---

## 二、部署方式（任选其一）

### 方式 A：Vercel（推荐，免费）

1. 注册 [Vercel](https://vercel.com)，用 GitHub 登录
2. 新建项目 → 导入你的 Git 仓库（或本地上传）
3. 框架预设选 **Vite**
4. 点击 Deploy，完成
5. 会得到一个网址，如 `https://xxx.vercel.app`，手机/电脑均可访问

**命令行部署（可选）：**

```bash
npx vercel
```

按提示登录并部署，会自动生成访问链接。

---

### 方式 B：Netlify（免费）

1. 注册 [Netlify](https://netlify.com)
2. 拖拽 `dist` 文件夹到 Netlify 网页的部署区域
3. 或：新建站点 → 连接 Git → 选择仓库
4. 构建设置：
   - Build command: `npm run build`
   - Publish directory: `dist`
5. 部署完成后获得 `https://xxx.netlify.app`

---

### 方式 C：GitHub Pages

1. 在项目根目录创建 `vite.config.js` 时，确保 `base` 为仓库名（若使用 GitHub Pages 子路径）：

```js
// vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  base: '/JadeTycoon-Web/',   // 替换为你的仓库名
  plugins: [react(), tailwindcss()],
})
```

2. 在 GitHub 仓库 Settings → Pages：
   - Source: GitHub Actions
   - 或 Source: Deploy from branch，选择 `main` 分支，目录选 `/dist`

3. 若使用 GitHub Actions，创建 `.github/workflows/deploy.yml`：

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]

jobs:
  build-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run build
      - uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./dist
```

4. 访问地址：`https://你的用户名.github.io/JadeTycoon-Web/`

---

### 方式 D：自有服务器 / 静态托管

将 `dist/` 目录下的所有文件上传到任意支持静态网站的服务器（Nginx、Apache、CDN 等），确保：

- `index.html` 为入口
- 支持 SPA 路由（若有）：所有路径回退到 `index.html`

---

## 三、移动端访问

- 已做响应式适配，手机浏览器打开即可正常游玩
- 建议用户将网址「添加到主屏幕」以获得接近 App 的体验

---

## 四、存档说明

- 存档保存在浏览器的 **localStorage**
- 同一设备、同一域名下，存档会保留
- 清除浏览器缓存/隐私数据会丢失存档
- 换设备、换浏览器需重新开始（除非后续接入云存档）
