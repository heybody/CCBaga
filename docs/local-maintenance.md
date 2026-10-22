# 2026-10-22 Desktop登录增强与身份专用界面

当前分支：`codex/desktop-auth-identity-only`，基于已安装的v0.2.48维护分支；版本 `0.2.48+local.2`。本次没有移植v0.2.49新功能。

- macOS Desktop `config.json` 的 `oauth:tokenCache`、`oauth:tokenCacheV2`、`lastKnownAccountUuid` 纳入加密身份归档，与既有Cookie和Safe Storage同一事务恢复；其他偏好保留。只含偏好的配置不算当前身份。
- 老归档仍按原格式恢复，缺少的新字段不伪造；恢复前清除上一身份缓存，避免串号。旧登录若被服务端以session_stale_relogin拒绝，需重新登录后再暂存，不能承诺永不重登。
- 移除傻瓜设置、网络环境、浏览器环境、电脑环境的页面入口和导入；默认身份管理，帮助同步精简；撤销相关系统/网络/浏览器设置IPC，取消macOS伴随浏览器注册。保留旧身份关联的数据结构和兼容接口，mbp浏览器联动仍关闭，未安装B。
- 42项身份测试通过，1项性能样本忽略；23项前端测试、TypeScript/Vite及包签名核验通过。新回归覆盖Desktop A/B往返、旧归档、失败回滚、字段白名单及空身份判断；未自动切换用户真实账号。
- 替换前旧版A及完整保险库备份：`builds/ccbaga-maintenance/rollback/20261022-135438/`。安装前后保险库逐文件内容一致。测试日志在维护目录logs中（忽略）。
- 维护源码只保存在本地分支，不推送第三方上游；主仓库保存可应用补丁。后续需要上游更新时对照移植。

以下为上一版历史接手记录：

# v0.2.48 本地维护与接手说明

更新至：2026-10-17 23:05（Asia/Taipei）

## 当前状态

- 分支：`codex/identity-switch-fix-0.2.48`；基线 `v0.2.48` / `30a171f`。
- 旧修复分支 `codex/identity-switch-fix` / `a9d0ca8` 保留，不重写历史。
- 已编译候选宿主A：`0.2.48+local.1`，debug/custom-protocol、UI内嵌、本地ad-hoc签名。
- 已于2026-10-17 23:05安装并启动 `0.2.48+local.1`；替换前再次通过38项身份与23项前端测试，数据库quick_check正常、无恢复事务。安装前后保险库逐文件内容一致。未执行真实账号切换。
- 本次回退副本：`builds/ccbaga-maintenance/rollback/20261017-230457/`，包含旧A `0.2.43+local.3`与完整保险库（Git忽略）。
- 用户只使用Claude Code/Desktop，不需要独立浏览器B。用户最新要求：后续清理干净B。不要安装B、开启联动或使用真实浏览资料做测试。

## 移植内容

| 新提交 | 来源和行为 |
| --- | --- |
| `a7b9fd9` | 移植`69b35f0`核心逻辑：动态备份路径恢复不依赖文件当前存在，类别/路径/键边界保留；Desktop-only邮箱未知明确提示。保留上游8MiB读取上限、新字段常量和进度UI。 |
| `e8ba360` | 移植`b7686cf`：未知账号普通保存复用当前槽位，不新增卡片，名称保留；自身重选保存最新状态，不回灌旧归档；新账号、空工作区、恢复检查点独立。工作区槽位与实际账号验证分离。 |
| `348db0b` | 不重复移植旧`d3dc1ba`清理实现，沿用上游compact/collect；补测发现上游成功回滚后仍留空记录，现补调用统一回收，并在删除空记录前将悬挂active指针改为empty。 |

保留上游扩大后的账号/桌面站点存储范围、保留选项语义、详细进度、选择性文件清理、既有目录权限保护与新探针。未实施目录槽位提速、删减sync_all或改写钥匙串策略。Desktop邮箱提示不是新增邮箱识别功能。

## 验证

- Rust身份回归：**38 passed、0 failed、1 ignored**（手动性能样本）。包含上游全部身份测试与移植场景。
- 前端：**23 passed、0 failed**；TypeScript/Vite构建通过。
- 无头浏览器虚构IPC：**53项通过**；引擎从本机已有Browser.zip临时解压，只使用临时HOME和合成资料，未安装或启动桌面B。测试结束已清理源码中的Browser.app。
- 宿主包构建通过；核验Bundle ID、版本、`codesign --verify --deep --strict`及实际UI资源引用通过。
- 上游保留一条`fetch_update`弃用警告，不影响本轮构建。没有真实账号切换、真实钥匙串授权或新旧速度对比结果。

## 构建与安装入口

主工作区 `builds/ccbaga-maintenance/` 保存 `build-local.sh`、`local-build.json`、`install-host.py`、补丁和本机回退记录。脚本已配置候选版本 `0.2.48+local.1`。

```sh
# 在主工作区根执行：
sh builds/ccbaga-maintenance/build-local.sh
# 下条命令会备份并替换A：
python3 builds/ccbaga-maintenance/install-host.py
```

安装脚本只替换A，先确认没有待恢复事务，保存旧应用和完整保险库，验证安装前后保险库内容一致。B不在安装目标中。当前A包仍含上游的嵌入浏览器载荷，这与安装B应用不是一回事；后续若要裁掉载荷，要一起检查构建资源依赖，不可直接破坏现有签名包。

保险库在 `~/Library/Application Support/ai.local.requirement-french/identity-vault`；保留归档、`key.bin`和SQLite，不把凭据正文写入Git或日志。原版与local.1/local.2回退包见旧分支接手说明和主工作区维护记录。

## 待办与后续约束

1. 用户明确要求后续清理B：已核实`/Applications/CCBaga-B.app`及`~/Applications/CCBaga-B.app`均不存在，临时测试引擎已移除；剩余浏览器配置/资料先盘点，区分Claude Desktop、保险库、回退包与仅属B的内容，再清理。不要触碰身份备份或Claude数据。
2. 如要求安装新版，使用已验证的A单独安装流程；不安装B。不自动把本次移植当作真实登录验收。
3. 快速目录切换仍只评估，需另行授权范围与测试事务恢复。钥匙串访问弹窗未优化，不能承诺免授权。
4. 下次上游升级先fetch比较，保留旧分支与可用安装包；在新基线上按行为移植必要部分，不机械应用旧全量patch。

没有设置定时监控、推送上游或公开发布。
