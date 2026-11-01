# .github/workflows/
> L2 | 父级: ../CLAUDE.md

cares-build.yml: heybody/CCBaga 本地维护分支专用；推 cares/** 跑前端、身份 GUI 模拟、原生钥匙串桥与 cargo 回归，并构建 macOS arm64 宿主 A（debug、custom-protocol、ad-hoc），产物上传 Actions artifact；推 v*local.* 标签（须与 packaging/cares/local-build.json 版本一致）只构建并发布 Release（zip + checksums.txt）。浏览器载荷由 fetch-browser.py 下载固定引擎后 ad-hoc 打包；不使用 Apple、更新签名或其他 Secrets。上游 checks.yml、release.yml 在本分支删除。
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
