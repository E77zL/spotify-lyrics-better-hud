# 上传 GitHub 与原作者署名

## 上传源码

可以先 Fork [原作者仓库](https://github.com/Fanbeixi/spotify-lyrics-HUD_CN)，保留 GitHub 上的来源关联，再提交本源码包的内容。也可以建立独立仓库；独立仓库更要保留 README 首段的上游链接和衍生说明。

把源码 ZIP **解压后的内容**作为仓库根目录上传，确保根目录直接有 `README.md`、`Build.ps1`、`app/` 和 `.github/`，包括以点开头的文件。不要上传本机的 `outputs/`、安装目录、`connection.json`、校时缓存、`.cache/`、`.build/` 或 `dist/`。发布包已经排除这些内容。

根目录 `LICENSE` 是集成代码的 MIT；`licenses/HUD-LICENSE.txt` 是原作者 MIT，必须保留原来的版权行和完整正文。`CREDITS.md` 与 `NOTICE.txt` 说明了原作和你的修改范围，不要删除。可以在集成贡献者名单中添加自己的 GitHub 用户名，勿把原作者替换成自己。

## 发布可执行文件

源码构建需要 Node.js 22+、Visual Studio 2022 或更新版本的 C++ 工具链（C++20）、Windows SDK 10.0.22000+。在仓库根目录运行 `powershell -NoProfile -ExecutionPolicy Bypass -File .\Build.ps1` 生成轻量包，添加 `-Offline` 同时生成内置Spicetify程序包的完整离线版；已有依赖缓存可添加 `-CacheDir <缓存目录>`。两种安装器均内置对应源码和许可证。轻量版仅在没有已安装的Spicetify时下载锁定版本并校验SHA256，不检查新版本。Windows Composition和解压缩由系统提供，无需额外运行库安装包。

1. 仓库选择 **Releases → Draft a new release**。
2. 创建标签 **v2.0.3**，标题可写 `Spotify Lyrics HUD Companion 2.0.3`。
3. 上传 `Spotify-Lyrics-HUD-Setup-v2.0.3.exe`、`Spotify-Lyrics-HUD-Setup-v2.0.3-Offline.exe`、`Spotify-Lyrics-HUD-Source-v2.0.3.zip` 和 `SHA256SUMS.txt`。
4. 在说明中写明这是基于 Fanbeixi 项目的衍生集成，并粘贴下方署名段落。

编译后的单文件 EXE 应放在 **Release 附件**中，源码提交到 Git 仓库。项目附带的 GitHub Actions 工作流只构建和上传运行产物，不会自动公开发布 Release；在 Actions 中手动运行即可获取编译结果。

## 可直接使用的署名

```markdown
### Credits

本项目基于 [Fanbeixi/spotify-lyrics-HUD_CN](https://github.com/Fanbeixi/spotify-lyrics-HUD_CN) 开发，感谢原作者提供歌词窗口与基础实现。
本衍生版本添加了 Spotify 启动联动、客户端 A 开关、网易云兜底、逐曲校时与播放时钟同步等功能。
保留原项目 MIT 许可证与版权声明，详细第三方来源见 CREDITS.md 和 licenses/。
```

MIT 不要求给原作者付费或额外索取许可，要求保留版权与许可声明。README 致谢和上游链接能让用户看清来源；单独点一个 Star 不能替代许可证保留。Spicetify 的 LGPL 许可与对应源码也已随安装器提供，发布时继续保留。
