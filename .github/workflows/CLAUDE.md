# .github/workflows/
> L2 | 父级: ../CLAUDE.md
> local.15 身份专用版：不编译或启动 B 浏览器，不提供浏览器 IPC、指纹迁移或提示；旧 browser.enabled 在打开库时关闭，旧资料仅保留兼容，不参与身份事务。UI 测试使用 runner 系统 Chrome。

cares-build.yml: heybody/CCBaga 本地维护分支专用；推 cares/** 跑前端、身份 GUI 模拟、原生钥匙串桥与 cargo 回归，并构建 macOS arm64 宿主 A（release、custom-protocol、ad-hoc；与 Windows 安装包同为优化构建），产物上传 Actions artifact；推 v*local.* 标签（须与 packaging/cares/local-build.json 版本一致）只构建并发布 Release（zip + checksums.txt）。安装包不含浏览器 B 引擎（TAURI_CONFIG 与 local-build.json 删除 Browser.zip 资源），fetch-browser.py 只在分支构建时下载引擎供 UI 模拟测试；不使用 Apple、更新签名或其他 Secrets。上游 checks.yml、release.yml 在本分支删除。
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
