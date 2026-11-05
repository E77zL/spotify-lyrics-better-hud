# Credits / 致谢与来源

本衍生仓库由 [E77zL](https://github.com/E77zL) 维护。

本项目是衍生集成，主要歌词窗口与最初实现来自 **Fanbeixi**，不是从零原创的歌词软件。

| 来源 | 使用范围 | 授权 |
| --- | --- | --- |
| [Fanbeixi/spotify-lyrics-HUD_CN](https://github.com/Fanbeixi/spotify-lyrics-HUD_CN)，HUD 5.1.0 | 歌词窗口的视觉设计、LRC 工具及 QQ 查询基础；1.3.0 窗口已改为原生实现 | MIT；原文见 `licenses/HUD-LICENSE.txt` |
| [Spicetify CLI](https://github.com/spicetify/cli)，2.46.4 | 官方 Spotify 客户端扩展接口与 A 按钮加载 | LGPL-2.1；见 `licenses/SPICETIFY-LICENSE`，对应源码随安装器提供 |
| [Coooookies / node-windows-smtc-monitor](https://github.com/LeagueTavern/node-windows-smtc-monitor)，1.0.12 | Windows 系统媒体信息回退 | MIT；见 `licenses/SMTC-LICENSE.txt` |
| [websockets/ws](https://github.com/websockets/ws)，8.22.0 | 认证的本地 WebSocket 通信 | MIT；见 `licenses/WS-LICENSE.txt` |
| [Electron](https://github.com/electron/electron)，31.7.7 / Chromium | 历史版本所用运行时，1.3.0 不分发 | 历史 Electron MIT 文本保留于 `licenses/ELECTRON-LICENSE.txt` |
| [LRCLIB](https://lrclib.net/)、QQ 音乐、网易云音乐 | 歌词数据来源 | 歌词版权归相应权利人所有，不作为本项目的 MIT 代码再授权 |

衍生集成修改包括：Spotify 启动/退出联动、A 开关和快速淡入淡出、稳定的歌词缩放布局、网易云兜底、三源歌曲身份校验、本地文件元数据兼容、逐曲 ±0.5 秒校时、Spotify 客户端时钟桥接、请求取消与有限缓存，以及控制台单文件安装器和构建测试。

上游发布包为 `v5.1.0/SpotifyLyricsHUD-Setup-5.1.0.exe`，SHA256：

```text
1fb3df8b7bb67d1c150c4a86827091bd2bdecb8cad08ffc27c5124f6d86e93e9
```

构建时下载并核验原作者发布包，不把本机安装目录或用户设置当成源文件。`app/` 中继承的代码和图标仍受上游 MIT 许可约束；修改文件不代表取得原作者的版权。发布时请保留本文件、`NOTICE.txt`、根目录 `LICENSE` 及 `licenses/` 全部原文。

Native 1.3.0 overlay uses nlohmann/json v3.11.3, copyright Niels Lohmann, MIT; see licenses/JSON-LICENSE.txt. Provider modules derive from Fanbeixi HUD and retain their original MIT attribution.
