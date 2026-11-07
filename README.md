<!--
[INPUT]: 本分支实际功能、上游基线、Release 附件与本地维护文档。
[OUTPUT]: CCD Switch 项目入口：定位、定制要点、与上游的差异、安装和使用边界。
[POS]: 本分支公开入口；上游原文保留在 docs/upstream-README.md，维护记录见 docs/local-maintenance.md。
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
-->

# CCD Switch

[![最新版本](https://img.shields.io/github/v/release/heybody/CCBaga?label=%E6%9C%80%E6%96%B0%E7%89%88%E6%9C%AC)](https://github.com/heybody/CCBaga/releases/latest)
[![构建](https://github.com/heybody/CCBaga/actions/workflows/cares-build.yml/badge.svg?branch=cares%2Fidentity-only-0.2.50)](https://github.com/heybody/CCBaga/actions/workflows/cares-build.yml)
[![许可](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

**Claude Code Desktop Switch**：在同一台电脑上，快速切换 Claude Code 与 Claude Desktop 的本地登录身份。

CCD Switch 基于 [liseami/CCBaga](https://github.com/liseami/CCBaga) 的 `v0.2.50` 定制开发。上游是身份、指纹浏览器、系统环境和网络的综合工具；本项目只留下身份管理，并围绕“每天切账号”重做了界面和流程。

**用途声明：** 仅供管理本人的 Claude 身份，禁止违反 Anthropic 官方用户协议的用途。切换的只是本地状态，不改变服务端记录，也不保证匿名或账号可用。

## 特色要点

- **只做身份切换：** 去掉伴生浏览器 B、系统环境和网络页面，不再带浏览器引擎，Windows 安装包约 3.7 MB。
- **Code 与 Desktop 一起切：** 在上游基础上，Desktop `config.json` 里的 OAuth 缓存和账号标识也随身份保存、恢复；Desktop 本机共用的 `Claude Safe Storage` 密钥不动。
- **紧凑深色切换器：** 单窗口身份列表，切换确认在底部弹层完成，可调整工作区保留项。
- **托盘直接看额度、发起切换：** 每个身份两行，显示 5 小时和 7 天用量进度条；点身份后回到窗口确认，托盘不会直接结束进程。
- **额度过期会提醒：** 样本超过 5 小时变灰，并提示去 Claude 刷新。额度读自 Claude Desktop 的本地记录，不联网、不读令牌，也不是实时值。
- **运行状态看得清：** 分为运行中、有残留、未运行。主程序退出后还有后台项时，可以确认后一键结束。
- **切换不丢手头工作：** “带入未完成会话”让会话跟着切到新账号，同名记录追加而不覆盖；“快速切换”挪动缓存和历史，不重新打包。
- **Windows 专项适配：** 支持 Claude 新版数据目录、Native Host 和 `CoworkVMService` 的识别与停止，并修复了多项切回故障。
- **Windows 应用内更新：** 只检查本 fork 的 Release，下载后核对 SHA-256 再安装，不结束 Claude，也不会被上游原版覆盖。

## 与上游的差异

| | 上游 CCBaga | CCD Switch |
| --- | --- | --- |
| 定位 | 身份、浏览器指纹、系统环境、网络工具集 | 只做身份切换 |
| 应用 | CCBaga-A + 伴生浏览器 CCBaga-B | 单个应用 |
| 界面 | 侧栏多页面 | 深色紧凑列表 + 托盘 |
| Desktop 身份 | 随身份保存 Desktop 登录文件 | 另外保存 `config.json` 的 OAuth 缓存和账号标识 |
| 额度 | 无 | 列表和托盘显示本地用量 |
| 更新 | 官方更新器 | 固定本 fork 的 Release |
| 发布平台 | macOS、Linux、Windows | macOS arm64、Windows x64 |
| 签名 | macOS Developer ID 与公证，Windows 未签名 | macOS ad-hoc，Windows 未签名 |

保险库、加密归档、切换回滚和崩溃恢复沿用上游，这也是本项目最依赖上游的部分。

## 安装

从 [Releases](https://github.com/heybody/CCBaga/releases/latest) 下载：

- **Windows 10/11 x64：** `CCD-Switch_<版本>_windows_x64-setup.exe`，安装到当前用户。未代码签名，SmartScreen 提示时选“仍要运行”。
- **macOS arm64：** `CCD-Switch_<版本>_macos_arm64.zip`，解压后放入“应用程序”。这是 ad-hoc 签名，没有公证。

校验值见同一 Release 的 `checksums-windows.txt` 和 `checksums.txt`。

## 使用须知

- 切换前先保存工作：需要结束 Claude 时，确认框会列出进程。
- 额度只覆盖 Claude Desktop 当前登录账号的采样，其他身份显示的是上次记录。
- 保险库防的是普通解压和误操作，不能隔离同一用户或管理员。
- 真实登录可能因服务端失效，需要重新授权。

## 文档

- [更新日志](CHANGELOG.md)
- [参与贡献](CONTRIBUTING.md)
- [安全策略](SECURITY.md)
- [本地维护记录](docs/local-maintenance.md)：分支、版本、每次改动和验证边界
- [身份存储和恢复边界](docs/identity-storage.md)
- [上游 README](docs/upstream-README.md)（[中文](docs/upstream-README.zh-CN.md)）：上游完整功能，其中浏览器、系统和网络部分不适用于本项目

## 许可

MIT，见 [LICENSE](LICENSE)，上游版权声明保留；第三方组件见 [NOTICE.md](NOTICE.md)。
