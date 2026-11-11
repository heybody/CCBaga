# identities/
> L2 | 父级: ../CLAUDE.md
> local.15 身份专用版：不编译或启动 B 浏览器，不提供浏览器 IPC、指纹迁移或提示；旧 browser.enabled 在打开库时关闭，旧资料仅保留兼容，不参与身份事务。UI 测试使用 runner 系统 Chrome。
mod.rs: 身份停止/备份/切换/恢复/删除启用 diagnostics/identity-current.jsonl 私有日志，4 MiB 后于下次操作滚动至 identity-previous.jsonl；记录版本、策略和开关，不记录身份名称或凭据正文。当前/空/已保存身份与停止/原地备份/切换/恢复/重命名/删除 Tauri 命令，复用 Cleaner 全局事务锁；普通刷新仅读 SQLite 和本地显示元数据，不打开 Store、不解密归档或回填摘要；进程预览至多 32 项，失败为 null 且停止状态保守未知；UI 不接收凭据正文。
database.rs: 停用历史浏览器联动，SQLite v3 管理稳定槽位、不可变归档代次、HMAC 索引与持久恢复状态；脱敏摘要读时重算本地过期状态，旧摘要未知；原地备份同事务提交档案/名称/摘要；迁移严格新增身份/摘要/可选绑定并拒绝已存账号，均不改选择指针，凭据正文不入库。
store.rs: 缓存移动前后记录源/目标、属性、系统错误和部分回填/自动恢复结果；原地加密备份只提交档案、不切换浏览器或清工作区；先验收归档再切换、失败回滚、独立恢复检查点与显式删除；迁移打开方式拒绝 recovery 且不回收旧暂存/归档或解包建索引；旧归档瞬态锁不恢复，非空同名目录按用户策略保留，清除/恢复按真实源计数，关键阶段及每 250ms 复查进程。
profile.rs: 只读显示白名单与本地凭据订阅/过期元数据，已认证归档生成脱敏摘要；状态只表示 local_unexpired/expired/refresh_available/api_key/unknown，不联网、不承诺自动续期，未知过期时间及旧摘要降级未知；API-only 设置仍是身份；只展示真实进程名/PID，不从可能复用 PID 的旧会话文件猜测工作区，不打开系统钥匙串或 Cookie。
credentials.rs: 默认 Code 凭据按用户策略合并身份与共享 MCP/插件秘密；Desktop 的 Claude Safe Storage 为本机共用密钥，不随身份读写；切换只删除目标身份没有的 Code 钥匙串项目，同服务同账户原地改值；正文只在原生内存流动。
archive.rs: 新身份分配独立编号；新快照排除固定锁的普通文件/空目录与精确默认 debug/latest 链接，不跟随或删除原件；通用迁移/恢复遍历仍拒绝全部链接；tar/Zstd 与旧 gzip 兼容验收，代次与卡片编号分离，源文件/压缩认证落盘/完整解包验收分阶段报告，完整认证后才交目录事务。
catalog.rs: 有界读取账号 UUID/组织（缺失时邮箱/组织），以本机 HMAC 匹配稳定槽位；显式事务打开 Store 时仅为缺账号索引的旧副本验收建索引，缺摘要不强制解密；提交后去重/回收，未知账号与恢复检查点不猜测合并，Desktop-only 暂存保守保留。
compression.rs: Zstandard 级别 3 流式压缩与校验和，读取侧限制窗口并按魔数兼容旧 gzip；外层认证协议不变。
optimization_tests.rs: 共享虚构账号夹具、A/B 连续切换、原地备份不动工作区与浏览器指针、缺摘要惰性保留、空身份往返、仓库路径/代理和跨应用不同账号资产保留、三平台路径契约、凭据刷新、跨组织隔离、崩溃恢复及压缩认证兼容；手动 500 会话性能样本不设 CI 时间阈值。
backup_tests.rs: 临时 A 浏览器/B CLI 备份保留真实不匹配、摘要失败事务回滚、旧归档锁不恢复而非空同名目录不丢数据；内嵌 SHA 固定的 v0.2.48 zstd 0.13.3 三平台合成 v1 tar，由当前 0.14.2 解包并只重定位到夹具执行恢复；不访问真实来源、进程或钥匙串。
codec.rs: 压缩流与 ring AES-256-GCM 帧，独立归档密钥和认证结尾；拒绝篡改、截断与非法归档成员。
portable.rs: 原生文件选择签发五分钟一次性路径令牌；BAGAP001 固定 PBKDF2-SHA256 600000 次/随机盐派生密钥，复用 AES-GCM/tar/Zstd；单保存身份完整认证、有界成员/字节/同 OS 白名单、目标 home 重定位与本机密钥重封存后严格新增记录；重复账号/种子拒绝，不导出主密钥/数据库/未选择共享秘密，不切换当前身份；忽略旧包 browser 配置，新导出不含该字段。
portable_tests.rs: 合成身份的迁移/新机 HMAC/密钥隔离/真实保留策略、密码/截断/篡改/尾随载荷/来源与成员拒绝、授票过期与一次性、不可覆盖和 SQLite 失败回滚；不访问真实账号或网络。
portable_windows.rs: 迁移包的 Windows 句柄所有者核验及成员名称边界；复用 TokenUser/实际 TokenOwner，拒绝 ADS、设备、尾点空格与大小写碰撞，不跟随名称检查信任已替换句柄。
private.rs: POSIX 0700/0600 与 Windows 创建时指定当前用户所有者/独占 DACL、原子写入及拒绝复用已有目标的独占目录创建；已有目录仅校验，不改写父级权限；Win32 名称调用统一走长路径。
tests.rs: 临时账号/会话的空身份、恢复、配置保留、损坏/链接拒绝、精确默认调试指针省略与根目录备份往返、选择删除、跨策略恢复与缺失主密钥拒绝；验证真实阶段与回滚，覆盖默认文件所有者、父级权限保留及不依赖 TEMP 长度的 Windows 超长路径往返，不接触真实账号。
usage.rs: 额度只读来源（借鉴 vibe-coding/mpb-probe）：读 Claude 桌面 App 本地 plan-usage-history.json（version 2），按组织 UUID 取最后一条 5 小时/每周百分比与采样时间；不读钥匙串、不碰令牌、不联网，格式不符返回空。组织 UUID 存于 SavedSummary.org 与 Current.org（均不送 UI），旧摘要缺组织时等下次保存才显示额度。
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md

本地维护：v0.2.50基线，根目录备份许可用上游实现，本地保留Desktop未知邮箱提示；详情见本地维护文档。

本地开关（SQLite state 的 carry_sessions / fast_archive，默认关闭）：带入未归档会话时仅切换强制会话历史留在工作区，原地备份始终包含会话历史，切换成功后把上一账号未归档的 Desktop 侧栏卡片挪到新账号目录（不覆盖），目标身份的旧会话只补缺挪入、同名 .jsonl 追加，避免目标下次归档时丢失；快速切换时切换归档的 cache/history 整路径来源不打包，manifest.plain 记录编号，数据整目录挪到 `<代次>.plain/data/{n}`，恢复同盘 rename，回滚/恢复用可重入 park 挪回原代次，旧完整归档照旧读取；原地备份、检查点与导出仍是完整数据，.plain 随代次回收。

本地未知账号普通保存沿用选中槽位；空工作区、新账号与恢复检查点仍独立；工作区槽位不冒充真实账号验证。

macOS/Windows本地增强：Desktop config.json仅随身份保存OAuth缓存两代字段和lastKnownAccountUuid；保留其他偏好，旧归档缺字段仍可恢复且清除当前账号缓存。四项回归覆盖往返、旧归档、回滚和白名单。

Windows local.8 回归：新 Claude-Data 登录字段/Cookie 与旧路径共存、空身份、A/B 往返和故障回滚，Cowork/内置 CLI/共享 Local State 保留；侧栏测试遍历 desktop_roots 全部目录。

local.10：identities_stop 缺失 confirmed 或不为 true 时在任务锁/原生结束进程前直接拒绝，不沿用旧版无确认调用。

local.12：store.rs 在清除身份之前的 park 部分失败时逆序回填已移动缓存，成功回填才解除事务；Windows 目录占用回归验证无悬挂 recovery、登录/缓存不变、解除占用后可继续往返。

local.14：Windows Logs/logs 仅叶节点大小写兼容，junction 和父路径重定向仍拒绝；恢复根目录备份不要求既有 HOME 属于本人，不改其 ACL/所有者。optimization_tests.rs 覆盖快/慢往返及 SYSTEM 所有 HOME。

local.16：State 增加 main_running 与 services；identities_stop_residual 要求 confirmed=true，持事务锁后重新枚举，主进程又打开则拒绝，否则结束已识别进程并停止后台服务。身份切换的 identities_stop 不变，不碰 CoworkVMService。
