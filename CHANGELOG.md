# 更新日志

本文件记录 CCD Switch 面向用户的变化，格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)。

版本号为 `<上游基线>+local.<本项目构建号>`：`0.2.50+local.20` 表示基于上游 CCBaga `v0.2.50` 的第 20 次本地构建。部分构建号只用于内部验证，没有发布 Release。

## [未发布]

## [0.2.50+local.22] - 2026-11-07

- Windows 与 macOS 共用设置内的软件更新。检查、下载进度、安装和重试都在原位置显示。失败时只显示简短提示，需要时可展开错误详情。
- macOS 支持应用内下载、校验、替换和重开。使用本地维护签名安装的副本会沿用原签名证书。

## [0.2.50+local.21] - 2026-11-07

### 修复

- macOS 托盘菜单的 7 天额度与 5 小时额度没有上下对齐。Windows 把制表符后的文字放进右侧对齐列，macOS 只把它当普通制表位；现在 macOS 按菜单字体量出名称宽度，补足制表符，让额度落在同一列。Windows 显示不变。

### 文档

- 写明 Windows 与 macOS 共用一个分支和版本号，改动需兼顾两个平台。

- 新增项目说明、更新日志、贡献指南、安全策略和 Issue / PR 模板。
- Release 说明改为取自本文件。

## [0.2.50+local.20] - 2026-11-07

包含未单独发布的 local.16 至 local.19。

### 新增

- 运行状态分为运行中、有残留、未运行。主程序退出后仍有后台项时，可确认后结束。
- 托盘显示每个身份的 5 小时和 7 天额度进度条，每个身份占两行，额度上下对齐。
- 额度样本超过 5 小时变灰，当前身份提示去 Claude 刷新。
- 更新窗打开时立即检查，并提供前往 GitHub 手动更新的入口。

### 变更

- Windows 不再在按钮行重复显示应用名。
- 托盘菜单顺序改为打开、身份、退出；打开项缩短，菜单宽度随身份名称收缩。
- 额度悬停提示简化为“N 小时前更新”。

## [0.2.50+local.15] - 2026-11-03

### 移除

- 伴生浏览器 B 及其运行入口、联动、状态提示和指纹迁移。旧资料保留但不再读取。

## [0.2.50+local.14] - 2026-11-02

### 修复

- Windows 上 `Logs` 目录大小写不同时被误报为链接，导致无法切回身份。
- 恢复根目录备份时，不再要求主目录的所有者是当前用户。

## [0.2.50+local.13] - 2026-11-02

### 新增

- 更新窗显示真实下载进度，校验通过后自动安装并重开应用。

### 变更

- 图标改为透明底粗线 C 字弧，Windows 托盘随系统栏明暗变化。
- 结束进程和安装更新的确认框默认勾选，仍须点击执行。

### 修复

- 安装更新前的目录检查把安装器文件当成目录。

## [0.2.50+local.12] - 2026-11-02

### 修复

- Windows 未识别独立的 Claude Native Host。
- 快速切换时部分缓存移动失败，留下未完成的恢复状态。现在会逆序回填已移动的内容。

## [0.2.50+local.11] - 2026-11-02

### 新增

- 深色紧凑切换器：插槽列表、底部确认弹层和设置抽屉。
- 托盘快捷切换身份，列表显示本地额度和套餐标签。
- Windows 应用内更新：只检查本 fork 的 Release，下载后核对 SHA-256（local.10 引入）。

### 变更

- 结束 Claude 进程前必须单独确认（local.10 引入）。
- 备份始终包含会话历史，“带入会话”只影响切换（local.9 引入）。

### 移除

- 使用说明页面。

## [0.2.50+local.8] - 2026-11-01

### 修复

- 支持 Windows 新版 Claude 数据目录和内置进程。

### 变更

- 关闭上游自动更新器，避免上游原版覆盖本项目。

## [0.2.50+local.7] - 2026-11-01

### 新增

- Windows x64 安装包。

## [0.2.50+local.6] - 2026-11-01

### 新增

- 带入未归档会话时，Desktop 侧栏卡片也跟着移到新账号。

## [0.2.50+local.5] - 2026-11-01

### 修复

- 切换不再读写本机共用的 `Claude Safe Storage` 密钥。

## [0.2.50+local.4] - 2026-11-01

### 变更

- 程序显示名改为 CCD Switch，Bundle ID 和保险库目录不变。

## [0.2.50+local.3] - 2026-11-01

### 变更

- 快速切换改为直接挪动缓存和会话历史，不再打包。

## [0.2.50+local.2] - 2026-11-01

### 新增

- “会话带入新账号”和“快速切换”两个开关。

## [0.2.48+local.3] - 2026-11-01

基于上游 `v0.2.48` 的身份专用版，可作回退版本。

[未发布]: https://github.com/heybody/CCBaga/compare/v0.2.50%2Blocal.20...cares/identity-only-0.2.50
[0.2.50+local.20]: https://github.com/heybody/CCBaga/releases/tag/v0.2.50%2Blocal.20
[0.2.50+local.15]: https://github.com/heybody/CCBaga/releases/tag/v0.2.50%2Blocal.15
[0.2.50+local.14]: https://github.com/heybody/CCBaga/releases/tag/v0.2.50%2Blocal.14
[0.2.50+local.13]: https://github.com/heybody/CCBaga/releases/tag/v0.2.50%2Blocal.13
[0.2.50+local.12]: https://github.com/heybody/CCBaga/releases/tag/v0.2.50%2Blocal.12
[0.2.50+local.11]: https://github.com/heybody/CCBaga/releases/tag/v0.2.50%2Blocal.11
[0.2.50+local.8]: https://github.com/heybody/CCBaga/releases/tag/v0.2.50%2Blocal.8
[0.2.50+local.7]: https://github.com/heybody/CCBaga/releases/tag/v0.2.50%2Blocal.7
[0.2.50+local.6]: https://github.com/heybody/CCBaga/releases/tag/v0.2.50%2Blocal.6
[0.2.50+local.5]: https://github.com/heybody/CCBaga/releases/tag/v0.2.50%2Blocal.5
[0.2.50+local.4]: https://github.com/heybody/CCBaga/releases/tag/v0.2.50%2Blocal.4
[0.2.50+local.3]: https://github.com/heybody/CCBaga/releases/tag/v0.2.50%2Blocal.3
[0.2.50+local.2]: https://github.com/heybody/CCBaga/releases/tag/v0.2.50%2Blocal.2
[0.2.48+local.3]: https://github.com/heybody/CCBaga/releases/tag/v0.2.48%2Blocal.3
