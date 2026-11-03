// [INPUT]: 含已开启 B 联动和失效旧指针的隔离 SQLite、虚构身份与旧浏览器资料哨兵。
// [OUTPUT]: 升级停用 B、不创建绑定、身份往返/备份不依赖 B、旧资料保持完整的回归。
// [POS]: 身份专用版的旧数据兼容；不操作真实账号或浏览器。
// [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
use super::*;
use super::optimization_tests::Fixture;

#[test]
fn legacy_enabled_browser_and_invalid_pointers_cannot_affect_identity_operations() {
    let f = Fixture::new();
    let r = Reporter::channel(None);
    let p = Policy::default();
    let s = store::Store::open(&f.vault, &f.home).unwrap();
    let legacy = new_id().unwrap();
    s.db.connection.execute("INSERT INTO browser_bindings VALUES(?1,'retired-slot',123)", [&legacy]).unwrap();
    s.db.connection.execute_batch("INSERT INTO state VALUES('browser.enabled','1'); INSERT INTO state VALUES('browser.active','invalid/old-slot'); INSERT INTO state VALUES('browser.previous','missing-slot'); INSERT INTO state VALUES('browser.next','missing-slot');").unwrap();
    let directory = f.root.join("browser-workspaces/retired-slot");
    private::directory(&directory).unwrap();
    private::write(&directory.join("keep"), b"legacy-profile-untouched").unwrap();
    drop(s);
    let mut s = store::Store::open(&f.vault, &f.home).unwrap();
    assert_eq!(s.db.get("browser.enabled").unwrap().as_deref(), Some("0"));
    f.login("A", "one", "a-token");
    s.save_current("A", &p, &r).unwrap();
    let a = s.records()[0].id.clone();
    for _ in 0..3 {
        s.switch("empty", "A", &p, &r).unwrap();
        s.switch(&a, "empty", &p, &r).unwrap();
        assert_eq!(f.token(), "a-token");
        assert!(s.db.get("recovery").unwrap().is_none());
    }
    assert_eq!(s.db.connection.query_row("SELECT COUNT(*) FROM browser_bindings", [], |row| row.get::<_,i64>(0)).unwrap(), 1);
    assert_eq!(s.db.get("browser.active").unwrap().as_deref(), Some("invalid/old-slot"));
    assert_eq!(s.db.get("browser.previous").unwrap().as_deref(), Some("missing-slot"));
    assert_eq!(std::fs::read(directory.join("keep")).unwrap(), b"legacy-profile-untouched");
}

#[test]
fn new_vault_has_no_browser_state_or_identity_bindings() {
    let f = Fixture::new();
    let mut s = store::Store::open(&f.vault, &f.home).unwrap();
    f.login("A", "one", "a-token");
    s.switch("empty", "A", &Policy::default(), &Reporter::channel(None)).unwrap();
    assert_eq!(s.db.connection.query_row("SELECT COUNT(*) FROM state WHERE key LIKE 'browser.%'", [], |row| row.get::<_,i64>(0)).unwrap(), 0);
    assert_eq!(s.db.connection.query_row("SELECT COUNT(*) FROM browser_bindings", [], |row| row.get::<_,i64>(0)).unwrap(), 0);
}
