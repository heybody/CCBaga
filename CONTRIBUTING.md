<!--
[INPUT]: 本分支的模块边界、测试入口、发布工作流与 GEB 契约。
[OUTPUT]: 贡献者需要遵守的开发、验证、隐私和发布规则。
[POS]: README 的贡献入口。
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
-->
# 参与贡献

欢迎提交问题和改进。本项目只做 Claude 身份切换；浏览器指纹、系统环境和网络相关的需求请提给[上游 CCBaga](https://github.com/liseami/CCBaga)。

## 开发环境

需要 Bun 1.3.5 和 Rust 1.98.1。

```bash
bun install --frozen-lockfile
bun test
bun run build
bun run test:identities
cargo test --locked --manifest-path src-tauri/Cargo.toml --features custom-protocol
```

`test:identities` 需要本机有 Chrome。打包命令和不含浏览器引擎的配置见 [.github/workflows/cares-build.yml](.github/workflows/cares-build.yml)。

## 提交 PR

- 基于默认分支 `cares/identity-only-0.2.50` 开发，PR 也提到这个分支。
- 提交信息用 `<type>(<scope>): <描述>`，type 为 feat、fix、docs、style、refactor、test、chore。
- PR 里写清问题、改动后的行为、跑过的检查和未覆盖的部分。
- 面向用户的改动写进 [CHANGELOG.md](CHANGELOG.md) 的“未发布”。
- 改动前读相关目录的 `CLAUDE.md`，改完同步文件头和模块说明。
- 原生操作放在 Rust 和平台桥里；界面文案同时改 `src/locales` 的中英文 YAML。
- 不要放宽清理范围、进程识别、权限检查和凭据处理；改到这些边界时加针对性的回归测试。
- 保留第三方声明。原创贡献按 [MIT 许可](LICENSE) 授权。

## Windows 与 macOS

两个平台共用一个分支和一个版本号。改动托盘菜单、窗口标题栏、样式、字体字符、路径、进程或更新入口时，同时考虑两个平台的系统行为，差异用 `cfg(target_os)` 或 `html.mac` 等平台类名分开处理。只在一个平台实测过的改动，在 PR 和 CHANGELOG 里写明另一平台未验证。发布前两个平台的 CI 都要通过。

## 报告问题

使用 [Issue 模板](https://github.com/heybody/CCBaga/issues/new/choose)，写明系统、版本、操作、预期结果和脱敏后的报错。

不要附上令牌、密码、私钥、身份归档或个人文件内容。安全问题按 [SECURITY.md](SECURITY.md) 私下报告。

## 发布

维护者更新 `packaging/cares/local-build.json` 的版本，把 CHANGELOG 的“未发布”改成新版本，等分支 CI 通过后在该提交上打 `v<版本>` 标签。工作流会构建两个平台，并以 CHANGELOG 中对应小节作为 Release 说明。
