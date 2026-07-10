# QQ Desk Pet

这是给小猫 QQ 做的跨平台桌面宠物，流程和主进程逻辑参考了 `/Users/yun/code/gaode_pet_v2`。QQ 的动作素材基于 `image/` / `img/` 里的照片特征用 `gpt-image2` 生成：白胸口、白爪、深色虎斑背、翘尾巴和绿黄眼睛。

## 功能

- 透明、无边框、置顶的桌面宠物窗口
- 支持待机、走动、坐下、跳跃、打招呼、睡觉
- 点击 QQ 打招呼，双击 QQ 跳跃
- 每隔一段时间会自己在桌面工作区里走动
- 鼠标悬浮显示动作按钮
- 系统托盘菜单可切换动作、显示/隐藏、重置位置或退出

## 安装

### macOS

1. 打开 [GitHub Releases](https://github.com/xiahaoyun/qq-desk-pet/releases) 下载最新的 `QQ-*.dmg` 或 `QQ-*-mac.zip`。
2. 如果下载的是 DMG，打开后把 `QQ` 拖到 Applications / 应用程序。
3. 第一次打开时，如果 macOS 提示来自未验证开发者，请在 Finder 里右键应用，选择“打开”，再确认打开。

### Windows

1. 打开 [GitHub Releases](https://github.com/xiahaoyun/qq-desk-pet/releases) 下载最新的 `QQ Setup *.exe` 或 `QQ *.exe`。
2. `QQ Setup *.exe` 是安装包，双击后按提示安装。
3. `QQ *.exe` 是 portable 版本，不需要安装，双击即可运行。

### 从源码运行

需要 Node.js 20 或更新版本。

```bash
npm install
npm run dev
npm run electron
```

开发时需要先保持 `npm run dev` 运行，再开启 Electron。生产打包会先执行 Web 构建。

## 打包

```bash
npm run build:web
npm run dist:mac
npm run dist:win
```

产物会输出到 `release/`。在 macOS 上只能直接打 macOS 包；Windows 安装包通常需要在 Windows 环境或 CI 上执行。

## 素材

公开仓库只保留生成后的桌宠素材，不提交原始照片。

生成素材在 `public/assets/`，桌宠运行时优先使用带 alpha 的 WebP：

- `qq-idle.webp`
- `qq-walk.webp`
- `qq-sit.webp`
- `qq-jump.webp`
- `qq-wave.webp`
- `qq-sleep.webp`

每个动作也保留了拆帧 PNG 和 WebP 版本，便于后续继续精修。

为避免一次性多帧图片生成导致身体闪烁或局部裁切，当前稳定版的流程是：先用 `gpt-image2` 生成完整单 pose / 关键 pose，源图保存在 `public/assets/generated/single-poses/` 和 `public/assets/generated/key-poses/`，再由 `scripts/build-qq-gifs.py` 本地组装成 WebP 动画。`walk / sit / jump / wave` 使用多张关键 pose，`idle / sleep` 使用稳定轻微呼吸循环。
