# 2026-11-01 移植到 v0.2.50，改由 GitHub 构建

当前分支：`cares/identity-only-0.2.50`（GitHub `heybody/CCBaga`），基线 `v0.2.50`；版本 `0.2.50+local.15`，构建配置 `packaging/cares/local-build.json`，工作流 `.github/workflows/cares-build.yml`。

local.15（2026-11-03）：移除 B 浏览器运行模块、启动入口、IPC、联动、状态提示、起始页和指纹迁移；身份切换/恢复/删除直接执行身份事务。打开旧保险库时仅将已有 browser.enabled 置 0，不创建新浏览器状态或绑定，旧绑定与资料保留兼容且不读取；旧迁移包 browser 配置忽略，新包不导出。新增旧库开启联动且含失效指针的隔离往返回归。默认跨平台配置不再打包 browser-ui、浏览器引擎或 B 快捷方式；构建仅含身份应用，UI 回归使用 runner 系统 Chrome。

local.14（2026-11-03）：修复 Windows Native Host 创建 `Logs` 与白名单 `logs` 大小写不同被误报链接的问题，仅允许末尾组件 ASCII 大小写差异，父路径重定向及 junction 仍拒绝。恢复根目录备份文件时，已有父目录只做路径边界检查，不要求 SYSTEM 所有的 HOME 属于当前用户，不修改父目录所有者或 ACL；身份文件仍严格核验所有权。新增真实大小写、快/慢模式往返、junction/父目录重定向拒绝和 SYSTEM 所有 HOME 的隔离回归。

local.13 图标定稿（2026-11-02）：按用户确认采用透明底、满幅粗线 C 字弧与圆点，应用 PNG/ICO/ICNS 共用矢量源；macOS 托盘为单色 template，Windows 托盘独立 32px，读取系统栏 SystemUsesLightTheme，明暗变化时更新字弧颜色，不依赖窗口主题。生成命令 `python scripts/make-ccd-icons.py`。Windows 与 macOS CI 改为独立构建；macOS 改用 Intel runner 跑原生与系统 Chrome 隔离 UI 回归，再交叉构建 arm64 应用，不把 Intel 测试描述为 arm64 实机验收；标签发布等两平台附件齐备再由草稿公开，避免 arm64 runner 容量不足阻塞 Windows 验证和出现半套 Release。安装和原生验证结果以维护仓库记录为准。

local.13（2026-11-02 用户要求）：修正安装前误把安装器文件本身传给目录检查器的问题，父目录和文件分别检查并复核 SHA-256；更新下载显示真实接收字节数与百分比，未知总量不伪造百分比；点击“下载并自动安装”后完成 SHA-256 校验、自动启动 NSIS passive 安装并重开 CCD Switch，仍不结束 Claude。进程结束与更新的确认框默认勾选，可取消勾选，操作仍须点击执行按钮；不可撤销删除/清理确认不预选。新增下载成功自动安装、字节/未知总量/校验阶段、下载失败不安装及安装启动失败重试的 UI 回归，原生回环 HTTP 验证实际字节进度及超限拒绝。

local.12（2026-11-02，win-desktop）：Windows 独立 Claude Native Host 纳入进程枚举及精确安装路径判定，沿用当前用户 SID、创建时间和原句柄复核。快速模式部分缓存移动失败时，先将已移动内容逆序回填，再撤销未开始清除身份的事务；不再反复移动同一占用目录导致自动回滚与恢复一起失败。移动错误保留系统错误码，不输出凭据正文。新增 Windows 真实目录句柄占用、缓存回填、释放后空身份往返及连接器相似路径拒绝回归。

用户现场：19:31 尝试切空身份，快速模式在第 6 项缓存处中断，恢复也停在 park；两份归档认证与数据库完整性正常。按用户要求，19:38 将已移动的 5 项缓存回填，117 项非移动归档文件/配置字段与现场完全一致，无登录字段被清除；保险库完整副本保存在主仓库忽略的 rollback/windows-recovery-20261102-193815。恢复 active/browser 指针并解除未完成事务后启动 Claude，界面确认 cares_ytbj / Pro、项目与会话可见。随后仅操作源码及隔离测试，不结束真实 Claude。

- 根目录 `.claude.json.backup*` 恢复许可改用上游 `90404e2` 的实现（与本地修复等价），本地只保留 Desktop 未知邮箱提示；上游的 `.claude/debug/latest` 链接跳过、原地备份、套餐/本地授权状态徽标、进程预览和加密导出/导入随基线带入。
- 继续保留：Desktop OAuth 缓存与账号标识随身份、未知账号复用当前槽位（`workspace_id`）、空快照回收时修正 active 指针、身份专用界面（不启动浏览器伴生服务）。
- 安装包不含浏览器 B 引擎（`local-build.json` 删除 `Browser.zip` 资源），约 57 MB；CI 只为 UI 模拟测试下载引擎。
- `0.2.50+local.2` 新增两个开关（身份页顶部）：「会话带入新账号」——会话留在工作区跟着切换，目标账号归档里的旧会话补缺并入（不覆盖，同名 .jsonl 追加），旧会话不会因下次归档丢失；「快速切换（不压缩）」——zstd -7，格式不变，新旧归档互相可读。实测 114 MiB 会话压缩不到 1 秒，切换耗时主要在 Desktop 资料读写与归档完整验收，会话带入对提速更有效。回归 `carry_sessions_keeps_live_history_and_merges_archived_without_overwrite`。
- `0.2.50+local.7` 增加 Windows x64 构建：`cares-build.yml` 的 windows 任务（windows-2025）跑前端与 Rust 全量测试（141 项），用 `packaging/cares/local-build.json` + `local-build-windows.json` 出当前用户 NSIS 安装包（不含浏览器 B 引擎与 B 快捷方式，未代码签名），标签构建附到同一 Release（`CCD-Switch_<版本>_windows_x64-setup.exe` + `checksums-windows.txt`）。兼容修正：侧栏会话卡片改用 `desktop_roots`（Windows 为 `%APPDATA%\Claude` 与 MSIX 路径）；Windows 的 Desktop `config.json` OAuth 缓存也随身份切换（DPAPI 本机共用，无钥匙串问题）；测试的 Desktop 路径按平台换算，原 macOS 专属的 Desktop 登录缓存测试同时在 Windows 运行。macOS 行为不变。
- `0.2.50+local.6` 带入未归档会话补上 Desktop 侧栏：Desktop 的 Code 会话卡片按 `claude-code-sessions/<账号>/<组织>/local_*.json` 分账号存放（卡片无账号字段，社区 claude-code-session-restorer 同样靠复制卡片恢复），开关打开时切换成功后把上一个账号 `isArchived:false` 的卡片挪到新账号目录；已归档、非卡片文件留在原处，同名不覆盖，失败只提示不影响切换。卡片里原账号的远程连接器配置与远程控制会话 ID 到新账号下可能无效。回归 `carry_sessions_moves_unarchived_desktop_sidebar_cards_to_the_new_account`。
- `0.2.50+local.5` 借鉴 claude-multi-accounts：Desktop 的 `Claude Safe Storage` 是本机所有账号共用的加密密钥，不再随身份读、删、写（原生快照不再读取，Rust `credentials::account_items` 过滤旧归档里的副本，副本保留在归档中备用）。local.4 的原地改值实测仍会让系统把分区列表重置为写入程序，Claude 每次切换仍要密码，故改为完全不碰。代价：以前切空身份时被删重建过密钥，旧归档里的 Desktop 登录可能是用另一把密钥加密的，切过去后 Desktop 显示未登录，需重新登录一次再「更新备份」。Code 的钥匙串项目照常切换。回归 `desktop_key_is_never_switched` 与原生隔离钥匙串测试。
- `0.2.50+local.4` 程序显示名改为 **CCD Switch**（`/Applications/CCD Switch.app`、窗口标题、托盘、侧栏品牌）；Bundle ID `ai.local.requirement-french`、保险库目录与数据不变，安装脚本替换旧名 `CCBaga-A.app`。钥匙串：切换时目标身份也有的项目（如 `Claude Safe Storage`）不再先删后建，而是原地改值，保留用户给 Claude Desktop 的「始终允许」与分区授权；以前每次切换都重建该项，Desktop 每次都要求输入钥匙串密码。切换到空身份、回滚与崩溃恢复仍删除重建（少见）。回归 `switching_keeps_items_the_target_also_has_for_in_place_update`。
- `0.2.50+local.3` 快速切换改为「挪数据」：开关打开时，切换出去的身份把缓存与会话历史（cache/history 类、整路径来源）整目录挪到 `identity-vault/<代次>.plain/data/{n}`，不压缩、不打包、不复核；登录、账号与配置类仍进加密归档并验收。归档 manifest 新增可选字段 `plain`（为空时与旧格式逐字节同构），旧完整归档照旧解包读取，第一次切入某个旧格式身份时仍较慢一次。恢复时缓存/会话一律同盘 rename；回滚与崩溃恢复用可重入的 `park` 先把数据挪回各自代次。原地备份与恢复检查点仍是完整归档；导出遇到挪动存放的数据缺失（该身份正在工作区）会提示先「更新备份」。旧代次与删除卡片时同名 `.plain` 目录一起回收。开关「会话带入新账号」更名「带入未归档会话」，目标账号旧会话改为挪入（不复制；同名 .jsonl 追加后删除存放副本）。回归 `fast_archive_moves_history_and_cache_with_rollback_recover_and_old_archive_mix`。
- 上一版 `codex/desktop-auth-identity-only`（v0.2.48）在 fork 上为 `cares/desktop-auth-identity-only`，Release `v0.2.48+local.3` 可作回退。

以下为上一版接手记录：

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

## 2026-11-01 Windows local.8 修复

- 补入 `%LOCALAPPDATA%/Claude-Data/claude_pzs8sxrjxfjjc`，沿用原有登录/缓存/字段白名单，未扩大到整个资料目录。
- 精确识别新路径下无 MSIX 包身份的内置 Code：三段数字版本/12 位十六进制构建编号/claude.exe，保留 SID、创建时间和进程句柄复核。
- 定制版更新入口改成手动打开 fork 的 Releases；移除生产 updater 注册、配置与权限，避免上游原版覆盖身份专用补丁。
- 增加新旧路径共存、空身份、往返、回滚、保留 Cowork/程序/Local State、重定向 AppData 与进程路径边界回归，侧栏测试遍历所有资料根目录。
- win-desktop 本地 24 项前端测试、TypeScript/Vite 构建通过；[原生 CI](https://github.com/heybody/CCBaga/actions/runs/41295567076) 的 macOS（140 项）与 Windows（144 项，0 失败、2 忽略）回归及安装包构建通过。Windows 包 SHA-256 为 `3119213fa9d558833bc6c9050536aef9a0b48655af6090524e1a44786c9763dd`，版本资源为 `0.2.50+local.8`，未代码签名。安装包代码提交为 `12b930b`；未操作真实账号。

## 2026-11-01 local.9 备份语义与身份界面

- 按用户要求移除“联动浏览器”的设置入口；保留旧浏览器绑定元数据、兼容处理与关联资料，不清理用户数据。
- “带入未归档会话”只控制身份切换；保存/更新备份始终包含当前会话历史，即使旧身份策略是留在工作区。备份仍打包、加密、验收，不挪走工作区数据；其他共享设置仍遵循原策略。
- “快速切换（不压缩）”改为“快速模式”：切换直接移动可移动数据，备份使用快速压缩，保持加密与校验。确认框的会话范围与原生执行一致。
- 新回归覆盖 carry/fast 四种组合下首次备份和更新，解密归档核对实际会话正文且工作区不变；UI 模拟验证按钮移除、双开关开启后的备份范围和 IPC 策略。
- 不操作用户桌面、不安装或切换真实身份。

local.9 验证：代码 `ebec208` 的 [CI 41312737786](https://github.com/heybody/CCBaga/actions/runs/41312737786) 成功，前端 24 项、界面模拟 67 项、macOS Rust 141 项、Windows Rust 145 项通过（Rust 各 0 失败、2 忽略）。Windows 候选安装包版本 `0.2.50+local.9`，SHA-256 `1c0acdcf443bff1e74f198135dc6f345cc78754dd85e160784f6f8e3914f1092` 已核对；未另发 local.9 Release，未安装。

## 2026-11-01 local.10 明确确认后才结束进程

用户反馈 local.9 的备份确认按钮未明确写出会结束当前进程。原说明位于长段落中，不能代替醒目告知。

- 身份保存/更新、切换/恢复、当前身份删除、CLI 维护及文件清理统一增加强制结束 Claude Desktop/Code、任务中断和未保存内容可能丢失的警告。
- 每次操作的进程确认默认不勾选；未勾选时按钮禁用且执行函数拒绝；取消后不发送结束/变更请求。保存、切换、恢复和维护的按钮直接写出结束进程。
- 默认焦点在取消；原生 identities_stop 只接受 confirmed=true，缺失/false 均在任何进程结束前拒绝。
- 仅修改代码和隔离测试，不操作用户桌面、安装软件或结束真实进程。

local.10 同时按用户要求加入应用内更新：启动及每六小时检测固定 fork 的完整 Windows Release（API 每次最多 20 条，跳过草稿、预发布及附件未齐的版本），按数字比较 +local 构建号；应用内下载、核对 SHA-256、安装前再次核对暂存字节。明确确认后只关闭 CCD Switch 并打开 Windows 安装器，不结束 Claude。HTTP 使用系统默认网络；不强加代理。其他系统沿用维护安装流程。仍需用已安装版本完成一次人工更新验收。

## 2026-11-01 深色切换器换皮（未发版）

只换前端外观，原生命令、参数与确认语义不变：

- 去掉侧栏与大标题，窗口默认 640×760（最小 520×560，macOS/Windows 配置）；整体为深色细网格主题（`html.ccd-dark`）。
- 身份改为插槽列表：当前身份置顶高亮、空身份固定最后；点行在原地展开切换确认（名称、保留范围、进程列表、每次独立勾选结束进程）；⋯ 菜单承载更新备份 / 重命名（行内）/ 删除，永久删除仍是默认聚焦取消的 AlertDialog。
- 切换成功后顶部提示可「切回」上一身份（含空身份），切回仍走完整确认。键盘：↑↓、Enter、1–9、Esc。
- 底部「带入会话 / 快速模式」开关与「工作区保留」抽屉；标题栏右侧为刷新、文件残留抽屉、设置抽屉（更新、界面动效、语言、使用说明、Claude Code CLI）。有新版本时标题栏出现更新提示。
- 按用户要求移除界面入口：浏览器联动标记/重开按钮、删除时的浏览器资料选项（固定传 `deleteBrowser:false`）、导入 / 导出。`identity-transfer.tsx` 与 `scripts/test-identity-transfer.ts` 保留但不再接入。
- 新增「界面动效」开关（`src/motion-preference.ts`，localStorage，默认开）：列表浮现、选中光带滑动与扫光、呼吸光点、切换扫描线、更新提示脉冲、抽屉/提示弹簧；关闭或系统「减弱动态」时全部静止。

验证：`tsc --noEmit`、`bun test`（24 项）通过；`CCBAGA_TEST_BROWSER=<本机 Chrome> node --experimental-strip-types scripts/test-identities-ui.ts` 中身份、更新、残留、操作进度、浏览器核验/清理、网络诊断用例全部通过，仅 `test-browser-profiles` 因本机未解包 `browser-runtime/Browser.app` 无法运行。尚未打包安装、未在真实 Tauri 窗口验收。

深色换皮第二轮：整体调亮对比度；运行状态并入标题栏、去掉快捷键提示行；个人默认组织名（<邮箱>'s Organization）与「状态未知」标签不再显示；空身份说明缩短；「带入会话」改称「带入未完成会话」。应用图标改为 assets/ccd-switch-icon.svg（深色身份插槽 + 切换箭头），重新生成 src-tauri/icons 的 png/icns/ico。

深色换皮第三轮：应用图标简化为深色底绿色开关；套餐改为名称旁彩色标签（Pro 蓝、Max 金、Team/Enterprise 紫）；原生层在凭据元数据缺套餐时（macOS 钥匙串不读）改用 .claude.json oauthAccount 的 organizationType / organizationRateLimitTier 推断，仅限已知值，不读令牌；已暂存身份的摘要要等下次保存才会补上套餐。初始窗口 460×500、最小 400×400。

菜单栏图标：macOS 托盘改用 src-tauri/icons/tray.png 单色模板图（线框开关），由系统着色，不再显示彩色应用图标；Windows/Linux 托盘不变。

图标定稿为 C 字弧加绿色开关点（应用与菜单栏模板图同形）。菜单栏快捷切换：identities.tsx 每次状态变化把身份名称列表推给 tray_identities_set；菜单点身份时显示窗口并经 tray-switch 事件打开该身份的行内确认，仍需逐次勾选结束进程，界面忙或有恢复任务时忽略。

额度显示：身份行下方显示桌面 App 本地用量样本的 5 小时/每周百分比条与采样时间（≥80% 黄、100% 红），非实时；无样本或旧摘要缺组织 UUID 时不显示。交互：主界面只显示身份操作进度，残留扫描结果留在残留抽屉，成功完成 4 秒后收起、打开确认时让位；打开确认自动滚到该行顶部，窄窗口确认面板改为单列。

紧凑行与切换弹层：身份行压成两行（名称+套餐；邮箱·组织·时间·大小），额度改为右侧竖排两条小进度条，采样时间放悬停提示；切换/备份确认改为底部弹层（标题与按钮固定、内容滚动、点遮罩或 Esc 取消、可从弹层直接调整工作区保留），恢复确认仍在恢复提示内。

应用内名称：标题栏、窗口标题与菜单栏“打开”项改为 Claude Code Desktop Switch；应用包名 CCD Switch（/Applications 路径、安装脚本依赖）不变。

macOS 标题栏：去掉顶部拖动条，标题栏与红绿灯同一行（左让 78px、高 32px 与系统按钮居中对齐），标题栏空白处拖动窗口；窗口窄于 520px 时运行状态只留圆点（悬停显示文字）。其他平台保留拖动条。

macOS 标题栏修订：红绿灯一行只放标题（.ccd-titlebar），运行状态与刷新/清理/设置按钮留在下一行，运行状态文字始终显示；两行空白处都可拖动窗口。
标题靠右显示。

macOS 运行状态对齐：第二行左侧“Claude 运行中”的圆点对准列表行首圆点/编号列（22px 列），文字对准身份名称列；未运行为灰色空心圆。

当前身份行的行首改为绿色高亮编号，不再用圆点，避免与运行状态圆点重复。

按用户要求移除使用说明（help.tsx 与设置抽屉入口）；macOS 抽屉标题行左让红绿灯。

## 2026-11-02 local.11 深色紧凑界面发布

汇总 local.10 之后的界面改动（深色紧凑切换器、C 字图标与菜单栏快捷切换、本地额度、两行身份行、底部确认弹层、红绿灯行标题），按用户要求移除使用说明，macOS 抽屉标题让出红绿灯；发布 Release 供应用内更新检测。
