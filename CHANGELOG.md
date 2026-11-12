# 更新日志

本文件记录 CCD Switch 面向用户的变化，格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)。

版本号为 `<上游基线>+local.<本项目构建号>`：`0.2.50+local.20` 表示基于上游 CCBaga `v0.2.50` 的第 20 次本地构建。部分构建号只用于内部验证，没有发布 Release。

## 0.2.50+local.26

- 修复 Windows 商店版 Claude 资料迁到 D 盘等其他磁盘时，Native Host 实际映像路径位于 WpSystem、被进程识别漏掉的问题。只解析已知官方根目录，保留当前用户、版本/文件名和进程句柄复核；切换前和残留清理均能识别该连接器。
- 修复 Windows 托盘额度 5h/7d、进度条、百分比错位：按系统菜单字体的实际绘制宽度补齐各列，兼容 Unicode 图形字形回退，macOS 沿用现有布局。
- 新增真实 junction、追加日志句柄阻挡目录移动以及系统菜单字体对齐回归。本轮仅构建，不安装、不重启；Windows 原生验证，macOS 实机未验证。

## 0.2.50+local.25

- 身份操作新增私有持久 JSONL 诊断日志，退出程序后保留时间、操作编号、版本、策略、阶段与回滚结果。
- 快速模式缓存移动记录源路径、目标路径、文件属性、系统错误码和原文；不记录凭据、配置值、缓存正文或进程命令行。日志达到 4 MiB 后在下次操作滚动，保留当前与上一份。
- Windows 真实目录占用回归覆盖失败现场落盘、缓存回填与凭据不进入日志；macOS 实机未验证。

## [未发布]

## [0.2.50+local.24] - 2026-11-08

### 改进
- 身份行更紧凑：去掉右侧「切换 →」列，悬停或聚焦其他身份时行首编号格变成「→」（提示「切换到 …」），点整行切换；额度块靠右贴着「⋯」，百分比贴近进度条。
- 额度过期时，采样时间并进副标题（「额度 14 小时前」，排在日期前），不再单独占一行，各行等高。

### 验证范围
- mbp：类型检查、双语文案检查、58 项 UI 模拟回归通过；460px 窗口截图核对，悬停前后各列位置与宽度不变。Windows 未实机查看。

## [0.2.50+local.23] - 2026-11-08

### 改进
- 软件更新恢复「GitHub 下载」按钮，可随时去 Release 页查看最新版并手动下载安装；在线更新按钮改名「在线更新」。
- 在线更新的进度显示已下载 / 总大小和百分比，校验和安装阶段也有进度条；标题栏提示显示百分比。
- 点击前说明在线更新只重启 CCD Switch，不关闭 Claude、不切换账号；macOS 另提示可能请求一次钥匙串授权（用于保持应用签名）。
- 启动和定时的后台检查失败只显示灰色「暂时无法检查更新」，不再弹红色报错；手动检查失败仍显示错误和重试。
- macOS Release 包改为优化（release）构建，与 Windows 安装包一致。

### 修复
- 身份列表悬停时额度和「切换 →」不再左右跳动；所有行固定预留操作列，当前行与其他行的额度列对齐。
- 下载或安装失败后，后台检查不再清掉「重试」状态（之前会导致重新下载）。
- 更新出错时不再出现「身份文件不属于当前用户」等身份模块的报错，改为更新语境的说明。

### 验证范围
- mbp：前端类型检查与构建、双语文案检查、58 项 UI 模拟回归（含 15 项更新流程）通过；悬停前后各行布局实测不变。Rust 原生回归与两平台构建以 CI 为准。
- macOS 从 Release 在线更新（下载 → 重签 → 替换 → 重开）与 Windows 在线更新尚未实机验证，发版后两台各走一遍。

## [0.2.50+local.22] - 2026-11-07

- Windows 与 macOS 共用设置内的软件更新。检查、下载进度、安装和重试都在原位置显示。失败时只显示简短提示，需要时可展开错误详情。
- macOS 支持应用内下载、校验、替换和重开。使用本地维护签名安装的副本会沿用原签名证书。
- 未发布 Release（只在 mbp 本机安装过）；两个平台的在线更新均未实机验证。

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
