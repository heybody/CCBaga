// [INPUT]: 原生默认凭据快照、用户 MCP/插件保留策略与 base64/JSON。
// [OUTPUT]: 仅身份字段变换的钥匙串写入协议；保留当前共享 MCP/插件秘密。
// [POS]: 保险库和 macOS Security 桥之间的秘密边界，不进入 GUI 或日志。
// [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
use super::Policy;
use base64::{engine::general_purpose::STANDARD, Engine};
use serde_json::Value;
fn object(item: &Value) -> Result<Value, String> {
    let bytes = STANDARD
        .decode(item["data"].as_str().ok_or("身份凭据无法处理。")?)
        .map_err(|_| "身份凭据无法处理。")?;
    let value: Value =
        serde_json::from_slice(&bytes).map_err(|_| "身份凭据格式不受支持，未修改凭据。")?;
    if !value.is_object() {
        return Err("身份凭据格式不受支持，未修改凭据。".into());
    }
    Ok(value)
}
fn encoded(value: &Value) -> String {
    STANDARD.encode(serde_json::to_vec(value).unwrap())
}
pub fn clear(items: &[Value], policy: &Policy) -> Result<Vec<Value>, String> {
    items
        .iter()
        .map(|item| {
            let mut result = item.clone();
            if item["service"] == "Claude Code-credentials" {
                let mut current = object(item)?;
                for key in crate::cleaner::identity::credential_keys(policy) {
                    current.as_object_mut().unwrap().remove(&key);
                }
                if !current.as_object().unwrap().is_empty() {
                    result["remaining"] = Value::String(encoded(&current));
                }
            }
            Ok(result)
        })
        .collect()
}
/// Desktop 的「Claude Safe Storage」是本机所有账号共用的加密密钥，不是账号凭据：切换、恢复、删除都不再读写它。
/// 改写这一项会让系统重置分区授权，Claude Desktop 每次切换都要输入钥匙串密码。旧归档里存的副本保留不用。
pub const DESKTOP_KEY: &str = "Claude Safe Storage";
pub fn account_items(items: &[Value]) -> Vec<Value> {
    items
        .iter()
        .filter(|item| item["service"] != DESKTOP_KEY)
        .cloned()
        .collect()
}
/// 切换时只删除目标身份没有的钥匙串项目；同服务同账户的项目由 restore 原地改值。
/// 删除后重建会丢掉用户给 Claude 的「始终允许」与分区授权，Desktop 每次切换都会要求输入钥匙串密码。
pub fn not_replaced(outgoing: &[Value], incoming: &[Value]) -> Vec<Value> {
    outgoing
        .iter()
        .filter(|item| {
            !incoming
                .iter()
                .any(|next| next["service"] == item["service"] && next["account"] == item["account"])
        })
        .cloned()
        .collect()
}
pub fn restore(items: &[Value], live: &[Value], policy: &Policy) -> Result<Vec<Value>, String> {
    items
        .iter()
        .map(|item| {
            let mut result = item.clone();
            let current = live
                .iter()
                .find(|row| row["service"] == item["service"] && row["account"] == item["account"]);
            if let Some(row) = current {
                result["expected"] = row["data"].clone();
            }
            if item["service"] == "Claude Code-credentials" {
                let saved = object(item)?;
                let mut value = if let Some(current) = current {
                    object(current)?
                } else {
                    serde_json::json!({})
                };
                for key in crate::cleaner::identity::credential_keys(policy) {
                    value.as_object_mut().unwrap().remove(&key);
                    if let Some(v) = saved.get(&key) {
                        value.as_object_mut().unwrap().insert(key, v.clone());
                    }
                }
                result["data"] = Value::String(encoded(&value));
            }
            Ok(result)
        })
        .collect()
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn changing_identity_preserves_current_mcp_and_plugin_secrets() {
        let row = |oauth: &str, mcp: &str| serde_json::json!({"service":"Claude Code-credentials","account":"fixture","data":encoded(&serde_json::json!({"claudeAiOauth":{"accessToken":oauth},"mcpOAuth":mcp,"pluginSecrets":"keep-plugin"}))});
        let current = row("current", "latest");
        let target = row("target", "old");
        let policy = Policy::default();
        let cleared = clear(&[current.clone()], &policy).unwrap();
        let remaining: Value = serde_json::from_slice(
            &STANDARD
                .decode(cleared[0]["remaining"].as_str().unwrap())
                .unwrap(),
        )
        .unwrap();
        assert!(remaining.get("claudeAiOauth").is_none());
        assert_eq!(remaining["mcpOAuth"], "latest");
        let next = restore(&[target], &[current], &policy).unwrap();
        let value = object(&next[0]).unwrap();
        assert_eq!(value["claudeAiOauth"]["accessToken"], "target");
        assert_eq!(value["mcpOAuth"], "latest");
        assert_eq!(value["pluginSecrets"], "keep-plugin");
    }
    #[test]
    fn desktop_key_is_never_switched() {
        let row = |service: &str| serde_json::json!({"service":service,"account":"a","data":"eA=="});
        let kept = account_items(&[row(DESKTOP_KEY), row("Claude Code-credentials")]);
        assert_eq!(kept, vec![row("Claude Code-credentials")]);
    }
    #[test]
    fn switching_keeps_items_the_target_also_has_for_in_place_update() {
        let row = |service: &str, account: &str| serde_json::json!({"service":service,"account":account,"data":"eA=="});
        let outgoing = [row("Claude Safe Storage", "Claude Key"), row("Claude Code", "me")];
        let incoming = [row("Claude Safe Storage", "Claude Key")];
        let removed = not_replaced(&outgoing, &incoming);
        assert_eq!(removed, vec![row("Claude Code", "me")]);
        // 目标是空身份时全部删除，行为不变。
        assert_eq!(not_replaced(&outgoing, &[]).len(), 2);
        // 原地改值依赖 restore 给出当前值作为 expected。
        let next = restore(&incoming, &outgoing, &Policy::default()).unwrap();
        assert_eq!(next[0]["expected"], "eA==");
    }
}
