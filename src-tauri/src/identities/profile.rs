// [INPUT]: 默认 .claude.json 的 oauthAccount 显示字段与白名单桌面工作区元数据。
// [OUTPUT]: 当前本地身份候选及有界用户名/邮箱/组织，明确区分桌面资料存在与账号邮箱已识别。
// [POS]: 身份卡片的只读展示边界；不读取钥匙串、Cookie 正文或任意项目文件。
// [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
use serde::{Deserialize, Serialize};
use std::{fs, io::Read, path::Path};
#[derive(Default, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Account {
    display_name: Option<String>,
    email_address: Option<String>,
    organization_name: Option<String>,
}
#[derive(Default, Deserialize)]
struct Config {
    #[serde(rename = "oauthAccount")]
    account: Option<Account>,
    #[serde(rename = "primaryApiKey")]
    api_key: Option<serde::de::IgnoredAny>,
}
#[derive(Default, Serialize)]
pub struct Current {
    pub present: bool,
    pub desktop_present: bool,
    pub display_name: Option<String>,
    pub email: Option<String>,
    pub organization: Option<String>,
    pub unavailable: bool,
}
fn display(value: Option<String>, limit: usize) -> Option<String> {
    value
        .map(|v| v.trim().to_string())
        .filter(|v| !v.is_empty() && !v.chars().any(char::is_control))
        .map(|v| v.chars().take(limit).collect())
}
fn parse(bytes: &[u8]) -> Result<Current, serde_json::Error> {
    let config: Config = serde_json::from_slice(bytes)?;
    Ok(match config.account {
        Some(account) => Current {
            present: true,
            desktop_present: false,
            display_name: display(account.display_name, 80),
            email: display(account.email_address, 254),
            organization: display(account.organization_name, 120),
            unavailable: false,
        },
        None => Current {
            present: config.api_key.is_some(),
            ..Current::default()
        },
    })
}
pub fn read(home: &Path) -> Current {
    let path = home.join(".claude.json");
    let result = (|| {
        let meta = match fs::symlink_metadata(&path) {
            Ok(m) => m,
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(Current::default()),
            Err(_) => return Err(()),
        };
        super::private::parents(home).map_err(|_| ())?;
        super::private::safe(&path).map_err(|_| ())?;
        if !meta.is_file() || meta.len() > 8 * 1024 * 1024 {
            return Err(());
        }
        let mut bytes = zeroize::Zeroizing::new(Vec::new());
        fs::File::open(&path)
            .map_err(|_| ())?
            .take(8 * 1024 * 1024 + 1)
            .read_to_end(&mut bytes)
            .map_err(|_| ())?;
        if bytes.len() > 8 * 1024 * 1024 {
            return Err(());
        }
        parse(&bytes).map_err(|_| ())
    })();
    let mut current = result.unwrap_or_else(|_| Current {
        present: true,
        unavailable: true,
        ..Current::default()
    });
    current.desktop_present = crate::cleaner::identity::desktop_present(home);
    current.present |= current.desktop_present;
    current
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn only_explicit_display_fields_reach_the_card() {
        let current=parse(br#"{"oauthAccount":{"displayName":" Person ","emailAddress":"fixture@example.invalid","organizationName":"Team","accessToken":"private"},"primaryApiKey":"private"}"#).unwrap();
        let output = serde_json::to_string(&current).unwrap();
        assert!(current.present);
        assert_eq!(current.display_name.as_deref(), Some("Person"));
        assert!(!output.contains("private"));
        assert!(!output.contains("Token"));
        assert!(parse(br#"{"primaryApiKey":"private"}"#).unwrap().present);
        assert!(!parse(b"{}").unwrap().present);
        assert!(!parse(br#"{"oauthAccount":null}"#).unwrap().present);
        assert!(display(Some("unsafe\nvalue".into()), 80).is_none());
    }
    #[test]
    fn free_account_display_does_not_depend_on_subscription() {
        let current = parse(br#"{"oauthAccount":{"emailAddress":"free@example.invalid","subscriptionType":"free"}}"#).unwrap();
        assert_eq!(current.email.as_deref(), Some("free@example.invalid"));
        assert!(current.present);
    }
    #[test]
    fn desktop_data_without_code_account_is_explicit_and_unverified() {
        let folder = std::fs::canonicalize(std::env::temp_dir()).unwrap()
            .join(format!("baga-profile-test-{}", super::super::new_id().unwrap()));
        super::super::private::directory(&folder).unwrap();
        super::super::private::write(&folder.join(".claude.json"), b"{}").unwrap();
        assert!(!read(&folder).present);
        let desktop = folder.join("Library/Application Support/Claude");
        super::super::private::directory(&desktop).unwrap();
        super::super::private::write(&desktop.join("Cookies"), b"opaque fixture").unwrap();
        let current = read(&folder);
        assert!(current.present && current.desktop_present);
        assert!(current.email.is_none());
        assert!(!current.unavailable);
        std::fs::remove_dir_all(folder).unwrap();
    }
}
