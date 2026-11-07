<!--
[INPUT]: 本项目的支持范围与 GitHub 私密漏洞报告入口。
[OUTPUT]: 面向报告者的安全策略。
[POS]: GitHub 安全策略入口；数据流和技术边界见 src-tauri/SECURITY.md。
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
-->
# 安全策略

## 支持的版本

只维护[最新 Release](https://github.com/heybody/CCBaga/releases/latest)，修复不会回补到旧版本。

## 报告漏洞

请通过 [GitHub 私密漏洞报告](https://github.com/heybody/CCBaga/security/advisories/new)提交，不要公开发 Issue。

请写明受影响的版本、系统、复现步骤和影响。不要附上真实令牌、密码或身份归档，复现时使用虚构账号。

这是个人维护的项目，没有响应时限承诺和漏洞奖励。

## 范围

重点关注凭据泄露、保险库加密绕过、越界删除文件、进程误杀和更新校验绕过。

本项目不把同一用户或管理员下运行的其他程序视为隔离对象，也不保证匿名或账号可用。技术边界见 [src-tauri/SECURITY.md](src-tauri/SECURITY.md)。
