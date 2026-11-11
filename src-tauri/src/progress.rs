// [INPUT]: 原生操作的真实阶段、完成数量与 Tauri 单次调用通道。
// [OUTPUT]: 有序脱敏进度、有界内存记录与可选的逐条持久 JSONL 诊断日志。
// [POS]: 只观察事务，供 Claude 清理与浏览器操作共享，不改变执行；不读取文件正文、凭据或配置值。
// [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
use serde::Serialize;
use std::sync::Mutex;
use std::time::Instant;
use std::{fs::File, io::Write, time::{SystemTime, UNIX_EPOCH}};
use tauri::ipc::Channel;
#[derive(Clone, Serialize)]
pub struct Progress {
    stage: String,
    status: String,
    message: String,
    current: usize,
    total: Option<usize>,
    elapsed_ms: u64,
}
pub(crate) struct Reporter {
    started: Instant,
    channel: Option<Channel<Progress>>,
    events: Mutex<Vec<Progress>>,
    disk: Mutex<Option<File>>,
    operation: String,
}
impl Reporter {
    pub(crate) fn channel(channel: Option<Channel<Progress>>) -> Self {
        Self {
            started: Instant::now(),
            channel,
            events: Mutex::new(Vec::new()),
            disk: Mutex::new(None),
            operation: format!("{}-{}", std::process::id(), SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_nanos()),
        }
    }
    pub(crate) fn with_file(self, file: File) -> Self {
        *self.disk.lock().unwrap() = Some(file);
        self
    }
    /// 仅接受受控元数据；绝不传入文件正文、配置值或进程命令行。
    pub(crate) fn diagnostic(&self, details: serde_json::Value) {
        let entry = serde_json::json!({
            "time_unix_ms": SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_millis(),
            "operation": self.operation,
            "elapsed_ms": self.started.elapsed().as_millis(),
            "details": details,
        });
        if let Some(file) = self.disk.lock().unwrap().as_mut() {
            // 日志故障不能中断身份事务；每条立即落盘，不依赖正常退出。
            if let Ok(mut bytes) = serde_json::to_vec(&entry) {
                bytes.push(b'\n');
                if let Err(error) = file.write_all(&bytes).and_then(|_| {
                    if details["event"] == "move_error" || details["progress"]["status"] == "error" || details["progress"]["status"] == "ok" { file.sync_data() } else { Ok(()) }
                }) {
                    eprintln!("诊断日志写入失败：{error}");
                }
            }
        }
    }
    pub(crate) fn log(
        &self,
        stage: &str,
        status: &str,
        message: &str,
        current: usize,
        total: Option<usize>,
    ) {
        let event = Progress {
            stage: stage.into(),
            status: status.into(),
            message: message.into(),
            current,
            total,
            elapsed_ms: self.started.elapsed().as_millis() as u64,
        };
        self.diagnostic(serde_json::json!({"event": "progress", "progress": &event}));
        let mut events = self.events.lock().unwrap();
        if events.len() == 2000 {
            events.remove(0);
        }
        events.push(event.clone());
        if let Some(channel) = &self.channel {
            let _ = channel.send(event);
        }
    }
    pub(crate) fn fail(&self, message: &str) {
        let stage = self
            .events
            .lock()
            .unwrap()
            .last()
            .map(|event| event.stage.clone())
            .unwrap_or_else(|| "validate".into());
        self.log(&stage, "error", message, 0, None);
    }
    #[cfg(test)]
    pub(crate) fn events(&self) -> Vec<Progress> {
        self.events.lock().unwrap().clone()
    }
}
#[cfg(test)]
impl Progress {
    pub(crate) fn stage(&self) -> &str {
        &self.stage
    }
    pub(crate) fn status(&self) -> &str {
        &self.status
    }
    pub(crate) fn current(&self) -> usize {
        self.current
    }
    pub(crate) fn message(&self) -> &str {
        &self.message
    }
}
