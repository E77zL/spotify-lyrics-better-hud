# 🎵 Spotify Lyrics HUD（Spotify 桌面悬浮歌词）

一个优雅的 Spotify 歌词显示工具，让你在做其他事情时，也能随时看到当前播放的歌词。

> 受 QQ 音乐的"桌面悬浮歌词"功能启发，为 Spotify 用户打造。

---

# Spotify Lyrics HUD（Spotify 悬浮歌词）

## 📸 效果演示

[Spotify 悬浮歌词效果演示]<img width="1884" height="1096" alt="a85e0e29bc744d5c7e92622c91d67e33" src="https://github.com/user-attachments/assets/0022deb0-40d5-4f16-981a-2061a8fd6bfe" />


*图片展示：Spotify 播放 Ariana Grande - "oh well" 时的歌词悬浮窗效果*

---

## ✨ 核心特性

- 🖱️ **可自由拖动和缩放** - 悬浮窗可以随意移动位置和调整大小
- 🔤 **字体大小可调** - 简单点击即可放大或缩小字体
- 🎨 **高度自定义** - 自定义背景色、透明度、歌词颜色
- 🌍 **智能歌词源** - 优先使用国际歌词库（LRCLIB），自动回退 QQ 音乐
- 🚀 **免费且轻量** - 无需 Spotify Premium，最小化占用系统资源
- 💾 **自动记忆** - 窗口位置和设置自动保存
- ⚡ **零配置** - 支持 Windows 和 macOS，开箱即用

---

## 🖥️ 系统要求

| 系统 | 版本 | 状态 |
|------|------|------|
| **Windows** | 10 (1809+) / 11 | ✅ 完全支持 |

**前置条件：** Spotify 桌面应用正在运行（推荐使用官方桌面客户端）

> **⚠️ 重要提示：** 本项目主要针对 **Spotify 桌面应用（Windows/macOS）** 进行开发和测试。网页版播放器的兼容性暂未确认，如使用网页版请自行测试效果。

---

## 📥 安装方式

### 选项一：一键安装（推荐）

下载对应系统的安装包并双击安装：

1. 前往 [Releases 页面](https://github.com/Fanbeixi/spotify-lyrics-hud/releases)
2. 下载最新版本的安装包：
   - Windows：`SpotifyLyricsHUD-Setup-*.exe`
3. 双击安装，自动创建快捷方式

### 选项二：从源码运行（开发者）

如果你想尝试最新开发版本或参与开发：

```bash
# 1. 克隆项目
git clone https://github.com/Fanbeixi/spotify-lyrics-hud.git
cd spotify-lyrics-hud

# 2. 安装依赖
npm install

# 3. 运行
npm start
```

---

## 🚀 快速开始

1. **启动程序** - 双击已安装的应用或运行 `npm start`
2. **打开 Spotify** - 确保 Spotify 桌面版正在播放音乐
3. **看到歌词** - 悬浮窗会自动出现在屏幕上，实时显示歌词

---

## 🎮 使用指南

### 基础操作

| 操作 | 说明 |
|------|------|
| **拖动** | 鼠标移到窗口上会显示工具条，点击 `⠿` 拖动窗口 |
| **缩放** | 把鼠标移到窗口边缘，出现调整光标后拖拽 |
| **调字体** | 点击工具条中的 `A-` 缩小或 `A+` 放大 |
| **关闭** | 点击工具条中的 `✕` 隐藏窗口（不退出程序） |

### 设置窗口

右键点击系统托盘图标（任务栏右下方）选择「设置」，可自定义：

- 🎨 **背景颜色和透明度** - 让歌词窗口融入你的桌面风格
- 🔤 **歌词文字颜色** - 确保良好的可读性
- ⚙️ **开机自启** - 每次启动电脑自动运行
- 👁️ **显示/隐藏歌词窗** - 快速切换窗口显示状态

所有改动**实时生效并自动保存**。

---

## 🎵 歌词源

程序会自动寻找歌词：

1. **首选：LRCLIB** - 国际社区维护的歌词库，外文歌曲覆盖面广
2. **备选：QQ 音乐** - 中文歌曲库覆盖全面

如果首选源找不到歌词，会自动尝试备选源。通常能覆盖市面上 90% 以上的歌曲。

---

## ⚙️ 开发者指南

### 项目结构

```
spotify-lyrics-hud/
├── main.js              # 主程序入口
├── preload.js           # 安全隔离层
├── config.json          # 配置文件
├── package.json         # 项目配置
├── src/                 # 核心逻辑模块
│   ├── nowPlayingTracker.js   # 播放信息获取
│   ├── smtcWorker.js          # Windows 实现
│   ├── lyrics.js              # 歌词获取流程
│   ├── lrc.js                 # LRC 格式解析
│   ├── settingsStore.js       # 配置持久化
│   └── ...
└── renderer/
    ├── main/            # 歌词窗口 UI
    └── settings/        # 设置窗口 UI
```

### 开发命令

```bash
npm start          # 运行开发版本
npm run dist       # 打包当前系统
npm run dist:win   # 打包 Windows 版本
```

### 自动化打包（GitHub Actions）

项目已配置 GitHub Actions，可以自动在云端打包两个平台：

```bash
# 1. 创建版本标签（必须以 v 开头）
git tag v5.1.0
git push origin v5.1.0

# 2. 自动触发打包流程
# Actions 页面会显示进度，完成后在 Releases 页面出现安装包
```

---

## 🔧 常见问题

**Q: 需要付费版 Spotify 吗？**  
A: 不需要。免费版本即可使用。

**Q: 支持 Spotify Web 播放器吗？**  
A: 本项目主要针对桌面应用开发。网页版的兼容性未经测试，建议使用官方桌面客户端以获得最佳体验。如你使用网页版，欢迎反馈效果！

**Q: 支持 Spotify 移动应用吗？**  
A: 不支持。本项目仅为桌面应用设计。


**Q: 歌词显示不准确或空白？**  
A: 可能的原因：
- 歌曲比较冷门，歌词库中暂无收录
- 网络连接问题，尝试重启程序
- 快速切歌导致歌词加载中，稍等片刻

**Q: 如何卸载？**  
A: Windows：设置 → 应用 → 已安装的应用 → 卸载  

---

## 📝 更新日志

### v5.1.0
- ✨ 新增 GitHub Actions 自动打包
- 🐛 修复快速切歌的歌词冲突问题


---

## 🙌 

本项目在以下伟大工具的帮助下完成╰(*°▽°*)╯：

- **Claude** - AI 代码助手，提供代码编写、架构设计和问题排查支持
- **WorkBuddy** - 项目管理和开发协作工具

---

## 📜 许可证

本项目采用 [MIT License](LICENSE) 开源，可自由使用和修改。

---

## 🔗 相关资源

- 🎵 [LRCLIB - 歌词库](https://lrclib.net)
- 🎧 [Spotify 官网](https://www.spotify.com)
- 💻 [Electron 文档](https://www.electronjs.org)

---

## 🙏 反馈与贡献

如有问题或建议，欢迎：
- [提交 Issue](https://github.com/Fanbeixi/spotify-lyrics-hud/issues)
- [发起讨论](https://github.com/Fanbeixi/spotify-lyrics-hud/discussions)
- Fork 本项目并提交 Pull Request

遇到网页版相关问题？欢迎在 [Discussions](https://github.com/Fanbeixi/spotify-lyrics-hud/discussions) 中分享你的使用体验！

---

## ⚠️ 免责声明

- 歌词数据来自第三方接口，仅供个人学习交流使用！！！！！
- 本项目无需登录 Spotify，不涉及账户数据
- 不对歌词的准确性和长期可用性做保证

---

**祝你使用愉快！🎉**

如果这个项目对你有帮助，欢迎给个 Star ⭐
