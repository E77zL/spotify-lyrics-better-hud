# Spotify Lyrics HUD（Spotify 悬浮歌词）

## v5.1.0 更新说明

- **新增：GitHub Actions 自动打包**：项目里加了
  `.github/workflows/build.yml`，推送一个 `v` 开头的 Git 标签就能在
  GitHub 免费的云端 Windows / macOS 虚拟机上自动打包两个平台的安装包，
  并自动发布到 Release 页面（也支持手动触发、仅打包不发布，方便日常
  测试）。详见下面「打包成安装包 → 办法二」。

## v5.0.3 更新说明

- **修复打包报错**：`npm run dist:win` / `dist:mac` 会报
  `configuration.mac has an unknown property 'extendInfoPlist'` 而失败。
  原因是我配错了字段名，你装的 electron-builder 24.13.3 版本里这个字段
  叫 `extendInfo`，不是 `extendInfoPlist`。已经在本地实际跑通打包流程
  验证过（Windows 目标一路跑到签名步骤、macOS 目标完整生成了 `.app`），
  确认配置本身没问题了。
- **修复切歌卡顿**：快速手动切歌（比如 A → B → A）时，偶尔会出现歌词
  长时间空白、或者显示的歌词跟当前播放对不上的问题。原因是网络请求是
  异步的，一首歌词请求还没返回时用户又切了别的歌，"迟到"的结果会错误地
  覆盖当前正在显示的歌词——现在加了防抖 + 过期结果丢弃两层保护。
- **移除翻译功能**：翻译相关的按钮、设置项、代码模块（`src/translate.js`
  以及 `qqmusic.js` 里译文对齐的部分）已经整体去掉，界面和设置都变得更
  简洁。歌词获取本身（LRCLIB / QQ 音乐）不受影响。

一个仿照 QQ 音乐"桌面悬浮歌词"效果做的 Spotify 小工具。

它是一个独立的小窗口：置顶显示在桌面上，可以自由拖动、缩放、调整字体，
会跟着 Spotify 桌面版当前播放的歌曲实时显示、高亮歌词。不需要改 Spotify
本身，关掉这个窗口也完全不影响 Spotify 正常使用。免费版 Spotify 账号即可
使用，不需要 Premium，也不需要登录授权。

**Windows 和 macOS 都支持**（详见下面「支持的系统」）。

---

## 目录结构

```
spotify-lyrics-hud/
├── main.js                  # 主进程入口
├── preload.js                # 渲染进程的安全桥接层
├── config.json                # 少量运行参数（轮询间隔等）
├── package.json
├── src/                       # 主进程用到的功能模块
│   ├── nowPlayingTracker.js     # 统一入口：根据系统选 Windows/macOS 的实现
│   ├── smtcWorker.js             # Windows：读取系统级 SMTC 播放信息
│   ├── macWorker.js              # macOS：用 AppleScript 问 Spotify 本身
│   ├── lyrics.js                  # 歌词获取主流程（LRCLIB → QQ音乐 兜底）
│   ├── qqmusic.js                 # QQ 音乐歌词源
│   ├── lrc.js                     # LRC 格式解析
│   ├── http.js                    # 带超时保护的 fetch
│   ├── settingsStore.js           # 设置的本地持久化
│   └── windowState.js             # 悬浮窗位置/大小记忆
├── renderer/
│   ├── main/                    # 悬浮歌词窗口的界面
│   │   ├── index.html
│   │   ├── renderer.js
│   │   └── style.css
│   └── settings/                # 设置窗口的界面
│       ├── index.html
│       ├── settings.js
│       └── style.css
├── .github/
│   └── workflows/
│       └── build.yml            # GitHub Actions：云端自动打包两个平台
└── assets/                      # 图标
```

根目录只保留 `main.js`、`preload.js`、`config.json` 这几个真正的程序入口，
不会有一堆零散网页文件混在最外层；悬浮歌词窗口和设置窗口的界面代码分别放
在 `renderer/main/` 和 `renderer/settings/` 下。

---

## 支持的系统

| 系统 | 播放信息读取方式 | 说明 |
|---|---|---|
| **Windows 10 1809+ / Windows 11** | 系统级 SMTC 接口 | 最准确，进度/暂停实时同步 |
| **macOS**（Spotify 官方桌面版） | AppleScript 直接询问 Spotify.app | 无需额外安装任何东西，首次运行会有一次系统权限弹窗，点"允许"即可 |

两边的核心逻辑（歌词获取、界面）完全共用，只有"怎么知道 Spotify 正在放
什么"这一步是平台专属实现，由 `src/nowPlayingTracker.js` 自动判断当前
系统去选择对应实现，用户不需要做任何额外配置。

> macOS 上如果不小心点了拒绝授权，可以去 **系统设置 → 隐私与安全性 → 自动化**
> 里找到本程序，手动勾选允许控制 Spotify。

---

## 功能一览

- 🖱️ 悬浮窗可拖动、可缩放，位置和大小会被记住
- 🔤 字体大小可调（顶部工具条 `A-` / `A+`）
- 🎨 设置窗口（托盘菜单 → 设置）里可以自定义：
  - 背景颜色 + 背景透明度
  - 歌词文字颜色
  - 开机自动启动
- 🀄 歌词源：主源是 [LRCLIB](https://lrclib.net)（国际社区维护，外文歌覆盖好），
  找不到时自动回退 QQ 音乐（中文曲库覆盖好）
- 📦 一键安装包：Windows 是免向导的"一键安装"exe，macOS 是标准 dmg

---

## 第一步：准备开发环境

1. **安装 Node.js**：去 [nodejs.org](https://nodejs.org/) 下载并安装（建议选左边写着 "LTS" 的那个版本），一路下一步安装完成即可。装完之后打开命令行，输入下面这行确认安装成功（能看到版本号就说明装好了）：

   ```bash
   node -v
   ```

2. **把项目文件夹放到你电脑上**：把这个项目解压/复制到你电脑上任意位置，
   比如 Windows 上放到 `D:\spotify-lyrics-hud`，或者 macOS 上放到
   `~/Documents/spotify-lyrics-hud`。**记住这个路径**，下一步要用到。

3. **打开命令行，进入这个文件夹**：

   - **Windows**：按 `Win + R`，输入 `cmd` 回车打开命令提示符（或者在开始菜单
     搜"PowerShell"打开也行），然后输入 `cd` 加上你放置项目的路径，比如：

     ```bash
     cd D:\spotify-lyrics-hud
     ```

     > 小技巧：也可以直接打开文件夹，在地址栏里输入 `cmd` 回车，会自动在
     > 这个文件夹路径下打开命令行，不用自己敲 `cd`。

   - **macOS**：打开"终端"App（可以按 `Cmd + 空格`，输入"终端"或
     "Terminal" 搜索打开），输入 `cd` 加上路径，比如：

     ```bash
     cd ~/Documents/spotify-lyrics-hud
     ```

     > 小技巧：把项目文件夹图标从"访达"里直接拖进终端窗口，会自动帮你
     > 填好完整路径，输入 `cd ` 后把文件夹拖进去再回车就行。

4. **确认你在正确的文件夹里**：输入下面命令，应该能看到 `package.json`、
   `main.js` 这些文件（Windows 用 `dir`，macOS 用 `ls`）：

   ```bash
   dir
   ```

   如果报错说找不到文件，或者列出来的文件不对，说明 `cd` 的路径不对，
   回到第 3 步重新确认路径。

5. **安装依赖**：确认路径没问题后，运行：

   ```bash
   npm install
   ```

   会看到一堆下载安装的滚动信息，等它跑完（通常一两分钟，看网速），
   中途出现的黄色 `npm warn` 警告可以忽略，不影响使用。

   > 国内网络访问 npm 官方源可能较慢或卡住，可以先切换淘宝镜像再装：
   > ```bash
   > npm config set registry https://registry.npmmirror.com
   > npm install
   > ```

6. **运行程序**：安装完成后，同一个命令行窗口里运行：

   ```bash
   npm start
   ```

   如果 Spotify 桌面版正在播放歌曲，几秒内就应该能看到悬浮歌词窗出现在
   屏幕上。以后每次想直接用源码运行，都是"进到这个文件夹 → `npm start`"
   这两步（第一次装过依赖后，`npm install` 不用每次都重新跑）。

---

## 打包成安装包

如果你只是自己用，上面「运行程序」那步 `npm start` 就够了，不需要打包。
打包是为了做出一个可以双击安装、发给别人也能用的独立安装包。

下面有两种办法：**办法一**是在自己电脑上手动跑打包命令（Windows 电脑打
Windows 包，Mac 电脑打 Mac 包，两个平台都要就得两台电脑各跑一次）；
**办法二**是用 GitHub Actions 云端自动打包（推荐，只需要一台电脑、
一个 GitHub 账号，两个平台的包会自动生成）。

### Windows：一键安装 exe

1. 确保你在 **Windows 电脑**上，并且已经做完上面「第一步：准备开发环境」
   （尤其是 `npm install` 那一步）。
2. 在项目文件夹的命令行里运行：

   ```bash
   npm run dist:win
   ```

   第一次运行会额外下载一些打包工具，需要联网，根据网速可能要几分钟，
   耐心等它跑完（能看到不少滚动日志是正常的）。

3. 打包完成后，回到项目文件夹，会多出一个 `dist` 文件夹，里面能找到：

   ```
   dist/SpotifyLyricsHUD-Setup-5.1.0.exe
   ```

4. 双击这个 `.exe`：会看到一个简短的安装进度动画（不需要点"下一步"
   "我同意"这些），装完自动创建桌面/开始菜单快捷方式并自动启动程序。
   这一个文件可以直接发给别人，对方双击就能装，不需要装 Node.js
   或任何开发环境。

5. 想卸载的话，和卸载普通软件一样，去"设置 → 应用 → 已安装的应用"里
   找到"Spotify悬浮歌词"卸载即可。

### macOS：dmg 安装包

1. 确保你在 **Mac 电脑**上，并且已经做完 `npm install`。
2. 在项目文件夹的终端里运行：

   ```bash
   npm run dist:mac
   ```

3. 打包完成后，同样在项目文件夹的 `dist/` 目录里，能找到：

   ```
   dist/SpotifyLyricsHUD-5.1.0-mac.dmg
   ```

4. 双击打开这个 `.dmg`，把里面的应用图标拖进"应用程序"文件夹，
   就像安装普通 Mac App 一样。

   > 由于本项目没有购买 Apple 开发者证书做签名/公证，第一次打开时
   > macOS 可能提示"无法验证开发者"或"已损坏"。这时候不要直接双击，
   > 改成右键（或按住 Control 点击）应用图标 → 选择"打开" → 再确认一次
   > "打开"，就能正常运行了，以后不会再提示。

### 办法一：本地命令行打包（前面 Windows / macOS 两小节就是这个办法）

上面「Windows：一键安装 exe」「macOS：dmg 安装包」两小节，本质上就是分别
在两台对应系统的电脑上手动跑一次打包命令：

```bash
npm run dist
```

会按你当前所在的系统自动选择对应的打包目标（Windows 上产出 exe，
macOS 上产出 dmg），效果和 `dist:win` / `dist:mac` 分别一致，喜欢简写
可以直接用这个。

> ⚠️ **无法跨平台打包**：在 Windows 上只能打出 Windows 安装包，在 macOS
> 上只能打出 macOS 安装包（跨平台打包理论上可行但依赖 Wine，配置复杂，
> 不在本说明范围内）。想要两个平台的安装包，需要分别在两台对应系统的
> 电脑上各打包一次——这也是下面「办法二」要解决的问题。

### 办法二：用 GitHub Actions 自动打包两个平台（推荐）

如果你不想自己找 Mac 电脑，项目里已经放了 `.github/workflows/build.yml`，
配合 GitHub 免费提供的 Windows / macOS 云端虚拟机，可以做到"推一个 Git
标签，两个平台的安装包自动生成好，还能自动挂到 Release 页面给别人下载"，
你自己完全不需要摸真的 Mac。

**用法：**

1. 把这个项目推到你自己的 GitHub 仓库（`git init` → `git add .` →
   `git commit` → 在 GitHub 网站新建一个仓库 → `git push`）。这一步不熟悉
   的话告诉我，我可以带你走一遍完整流程。
2. 打一个版本标签并推送（标签要以 `v` 开头，比如对应当前版本 `5.1.0`）：

   ```bash
   git tag v5.1.0
   git push origin v5.1.0
   ```

3. 打开你的 GitHub 仓库页面 → 顶部 "Actions" 标签页，能看到一个正在跑的
   "构建安装包" 流程（跑 Windows 和 macOS 两个虚拟机，通常几分钟内完成）。
   跑完之后：
   - 仓库的 "Releases" 页面会自动出现一个新版本，附带 Windows 的 `.exe`
     和 macOS 的 `.dmg`，别人访问这个链接就能直接下载。
   - 平时改代码想先测试一下、还不想正式发布：不用打标签，去 "Actions" 页面
     手动点 "Run workflow" 按钮，也能触发同样的构建，产物在这次运行页面
     下方的 "Artifacts" 里下载（不会出现在 Release 页面）。

**几个需要知道的细节：**

- 仓库需要设成 **Public（公开）**，或者虽然是 Private 但你的 GitHub 账号
  开通了 Actions 的付费额度——公开仓库的 Actions 分钟数完全免费。
- 不需要额外去申请任何密钥：`GH_TOKEN`（发布到 Release 要用到）是 GitHub
  Actions 自动提供的，工作流文件里已经配好了，你不用手动创建。
- 标签必须以 `v` 开头（`v5.1.0` 可以，`5.1.0` 不行），这是工作流文件里
  `on.push.tags` 那条规则决定的，想改成别的前缀可以直接编辑
  `.github/workflows/build.yml`。

---

## 使用说明

- **拖动**：鼠标移到悬浮窗上会浮现一条顶部工具条，按住最左边的 `⠿` 图标拖动。
- **调整大小**：把鼠标移到窗口边缘，出现调整光标后拖拽。
- **调字体**：顶部工具条的 `A-` / `A+`。
- **外观设置**：系统托盘图标右键 →「设置」，可以调背景色、透明度、歌词
  文字颜色、开机自启，所有改动实时生效、自动保存。
- **关闭悬浮窗**：顶部工具条最右边的 `✕`，只是隐藏，不会退出程序；想再
  打开就去系统托盘图标右键「显示歌词窗」，或者「退出」结束整个程序。

---

## 免责声明

- 歌词数据来自第三方接口（LRCLIB、QQ 音乐），仅供个人学习交流使用，
  不保证长期可用性和准确性。
- 本项目不涉及 Spotify 账号登录、不读写 Spotify 数据，只读取系统 /
  Spotify 应用本身暴露的"当前播放"信息用于同步歌词显示。
