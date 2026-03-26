use serde::Deserialize;
use std::collections::HashMap;
use std::path::PathBuf;
use tauri::AppHandle;
use tokio::fs;
use uuid::Uuid;
use walkdir::WalkDir;

use crate::atomic_io::write_text_atomic_async;
use crate::commands::paths::{app_data_dir, home_codex_dir};
use crate::models::{
    ModelUsageSummary, RestoreResult, SessionInfo, SnapshotMeta, SnapshotResult, SwitchResult,
    TokenUsageInfo, UsageStatsSummary,
};

// ─── Path helpers ─────────────────────────────────────────────────────────────

fn live_sessions_dir() -> Result<PathBuf, String> {
    home_codex_dir().map(|d| d.join("sessions"))
}

/// Validates that account_id is a well-formed UUID to prevent path traversal.
fn validate_uuid(account_id: &str) -> Result<String, String> {
    Uuid::parse_str(account_id)
        .map(|u| u.to_string())
        .map_err(|_| format!("Invalid account_id: must be a UUID (got {:?})", account_id))
}

fn account_snapshot_dir(app: &AppHandle, account_id: &str) -> Result<PathBuf, String> {
    let id = validate_uuid(account_id)?;
    app_data_dir(app).map(|d| d.join("sessions").join(id))
}

// ─── Directory copy (blocking, runs in spawn_blocking) ───────────────────────

fn copy_dir_recursive(from: &PathBuf, to: &PathBuf) -> Result<(u32, u64), std::io::Error> {
    let mut file_count = 0u32;
    let mut total_bytes = 0u64;

    for entry in WalkDir::new(from).min_depth(1) {
        let entry = entry?;
        let relative = entry
            .path()
            .strip_prefix(from)
            .map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e))?;
        let dest = to.join(relative);

        if entry.file_type().is_dir() {
            std::fs::create_dir_all(&dest)?;
        } else {
            if let Some(parent) = dest.parent() {
                std::fs::create_dir_all(parent)?;
            }
            let bytes = std::fs::copy(entry.path(), &dest)?;
            file_count += 1;
            total_bytes += bytes;
        }
    }

    Ok((file_count, total_bytes))
}

fn count_dir(path: &PathBuf) -> (u32, u64) {
    if !path.exists() {
        return (0, 0);
    }
    let mut file_count = 0u32;
    let mut total_bytes = 0u64;
    for entry in WalkDir::new(path).min_depth(1) {
        if let Ok(e) = entry {
            if e.file_type().is_file() {
                if let Ok(meta) = e.metadata() {
                    file_count += 1;
                    total_bytes += meta.len();
                }
            }
        }
    }
    (file_count, total_bytes)
}

#[derive(Debug, Deserialize)]
struct SessionIndexEntry {
    id: String,
    #[serde(default)]
    thread_name: Option<String>,
    #[serde(default)]
    updated_at: Option<String>,
}

#[derive(Debug, Deserialize)]
struct RolloutLine {
    #[serde(rename = "type")]
    entry_type: String,
    payload: serde_json::Value,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct TurnContextPayload {
    #[serde(default)]
    model: Option<String>,
}

#[derive(Debug, Deserialize)]
struct EventMessagePayload {
    #[serde(rename = "type")]
    message_type: String,
    #[serde(default)]
    info: Option<TokenCountInfo>,
}

#[derive(Debug, Deserialize, Clone)]
struct TokenCountInfo {
    #[serde(default)]
    #[serde(alias = "totalTokenUsage")]
    total_token_usage: Option<TokenUsageInfo>,
    #[serde(default)]
    #[serde(alias = "lastTokenUsage")]
    last_token_usage: Option<TokenUsageInfo>,
}

async fn latest_shared_session() -> Result<Option<SessionIndexEntry>, String> {
    let path = home_codex_dir()?.join("session_index.jsonl");
    if !path.exists() {
        return Ok(None);
    }

    let content = fs::read_to_string(path).await.map_err(|e| e.to_string())?;

    for line in content.lines().rev() {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }

        if let Ok(entry) = serde_json::from_str::<SessionIndexEntry>(trimmed) {
            return Ok(Some(entry));
        }
    }

    Ok(None)
}

fn add_token_usage(total: &mut TokenUsageInfo, usage: &TokenUsageInfo) {
    total.input_tokens += usage.input_tokens;
    total.cached_input_tokens += usage.cached_input_tokens;
    total.output_tokens += usage.output_tokens;
    total.reasoning_output_tokens += usage.reasoning_output_tokens;
    total.total_tokens += usage.total_tokens;
}

fn extract_token_usage(info: TokenCountInfo) -> Option<TokenUsageInfo> {
    info.total_token_usage.or(info.last_token_usage)
}

async fn parse_rollout_usage(path: &PathBuf) -> Result<(Option<String>, Option<TokenUsageInfo>), String> {
    let content = fs::read_to_string(path).await.map_err(|e| e.to_string())?;
    let mut session_model: Option<String> = None;
    let mut session_latest_tokens: Option<TokenUsageInfo> = None;

    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }

        let Ok(entry) = serde_json::from_str::<RolloutLine>(trimmed) else {
            continue;
        };

        match entry.entry_type.as_str() {
            "turn_context" => {
                if let Ok(payload) = serde_json::from_value::<TurnContextPayload>(entry.payload) {
                    if payload.model.is_some() {
                        session_model = payload.model;
                    }
                }
            }
            "event_msg" => {
                if let Ok(payload) = serde_json::from_value::<EventMessagePayload>(entry.payload) {
                    if payload.message_type == "token_count" {
                        if let Some(info) = payload.info {
                            if let Some(usage) = extract_token_usage(info) {
                                session_latest_tokens = Some(usage);
                            }
                        }
                    }
                }
            }
            _ => {}
        }
    }

    Ok((session_model, session_latest_tokens))
}

async fn read_usage_stats_summary_inner() -> Result<UsageStatsSummary, String> {
    let sessions_dir = live_sessions_dir()?;
    if !sessions_dir.exists() {
        return Ok(UsageStatsSummary {
            sessions_analyzed: 0,
            latest_model: None,
            total_tokens: TokenUsageInfo::default(),
            latest_total_tokens: None,
            models: vec![],
        });
    }

    let mut session_files: Vec<PathBuf> = WalkDir::new(&sessions_dir)
        .into_iter()
        .filter_map(Result::ok)
        .filter(|entry| entry.file_type().is_file())
        .filter(|entry| {
            entry
                .file_name()
                .to_str()
                .is_some_and(|name| name.starts_with("rollout-") && name.ends_with(".jsonl"))
        })
        .map(|entry| entry.into_path())
        .collect();

    session_files.sort();

    let latest_session = latest_shared_session().await?;
    let current_session_path = latest_session.as_ref().and_then(|session| {
        session_files.iter().find(|path| {
            path.file_name()
                .and_then(|name| name.to_str())
                .is_some_and(|name| name.contains(&session.id))
        })
    }).cloned();

    let recent_files: Vec<PathBuf> = session_files.iter().rev().take(40).cloned().collect();
    let mut total_tokens = TokenUsageInfo::default();
    let mut latest_total_tokens: Option<TokenUsageInfo> = None;
    let mut latest_model: Option<String> = None;
    let mut model_totals: HashMap<String, (u32, u64)> = HashMap::new();
    let mut sessions_analyzed = 0u32;

    if let Some(current_path) = current_session_path.as_ref() {
        let (current_model, current_tokens) = parse_rollout_usage(current_path).await?;
        latest_model = current_model;
        latest_total_tokens = current_tokens;
    }

    for path in recent_files {
        let (session_model, session_latest_tokens) = parse_rollout_usage(&path).await?;

        if session_model.is_none() && session_latest_tokens.is_none() {
            continue;
        }

        sessions_analyzed += 1;

        if latest_model.is_none() {
            latest_model = session_model.clone();
        }

        if latest_total_tokens.is_none() {
            latest_total_tokens = session_latest_tokens.clone();
        }

        if let Some(usage) = session_latest_tokens.as_ref() {
            add_token_usage(&mut total_tokens, usage);
            if let Some(model) = session_model.as_ref() {
                let entry = model_totals.entry(model.clone()).or_insert((0, 0));
                entry.0 += 1;
                entry.1 += usage.total_tokens;
            }
        } else if let Some(model) = session_model.as_ref() {
            let entry = model_totals.entry(model.clone()).or_insert((0, 0));
            entry.0 += 1;
        }
    }

    let mut models: Vec<ModelUsageSummary> = model_totals
        .into_iter()
        .map(|(model, (sessions, total_tokens))| ModelUsageSummary {
            model,
            sessions,
            total_tokens,
        })
        .collect();
    models.sort_by(|left, right| {
        right
            .total_tokens
            .cmp(&left.total_tokens)
            .then_with(|| right.sessions.cmp(&left.sessions))
            .then_with(|| left.model.cmp(&right.model))
    });

    Ok(UsageStatsSummary {
        sessions_analyzed,
        latest_model,
        total_tokens,
        latest_total_tokens,
        models,
    })
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

async fn snapshot_sessions_inner(
    app: &AppHandle,
    account_id: &str,
) -> Result<SnapshotResult, String> {
    let src = live_sessions_dir()?;
    let dst = account_snapshot_dir(app, account_id)?;
    let snapshot_parent = dst
        .parent()
        .ok_or_else(|| "Invalid snapshot destination".to_string())?
        .to_path_buf();
    let temp_name = format!(
        "{}.tmp-{}",
        dst.file_name()
            .and_then(|name| name.to_str())
            .ok_or_else(|| "Invalid snapshot directory name".to_string())?,
        Uuid::new_v4()
    );
    let temp_dst = snapshot_parent.join(temp_name);
    let backup_name = format!(
        "{}.bak-{}",
        dst.file_name()
            .and_then(|name| name.to_str())
            .ok_or_else(|| "Invalid snapshot directory name".to_string())?,
        Uuid::new_v4()
    );
    let backup_dst = snapshot_parent.join(backup_name);

    // Ensure source exists
    fs::create_dir_all(&src).await.map_err(|e| e.to_string())?;
    // Build snapshot in a temp directory first, so a failed copy does not destroy the last good snapshot.
    if temp_dst.exists() {
        fs::remove_dir_all(&temp_dst)
            .await
            .map_err(|e| e.to_string())?;
    }
    fs::create_dir_all(&temp_dst)
        .await
        .map_err(|e| e.to_string())?;

    let src_clone = src.clone();
    let dst_clone = temp_dst.clone();
    let (file_count, total_bytes) =
        tokio::task::spawn_blocking(move || copy_dir_recursive(&src_clone, &dst_clone))
            .await
            .map_err(|e| e.to_string())?
            .map_err(|e| e.to_string())?;

    let snapshot_time = chrono::Utc::now().to_rfc3339();

    // Write meta
    let meta = SnapshotMeta {
        file_count,
        total_bytes,
        snapshot_at: snapshot_time.clone(),
    };
    let meta_path = temp_dst.join(".snapshot_meta.json");
    let meta_json = serde_json::to_string_pretty(&meta).map_err(|e| e.to_string())?;
    fs::write(meta_path, meta_json)
        .await
        .map_err(|e| e.to_string())?;

    let had_existing_snapshot = dst.exists();
    if had_existing_snapshot {
        if backup_dst.exists() {
            fs::remove_dir_all(&backup_dst)
                .await
                .map_err(|e| e.to_string())?;
        }
        fs::rename(&dst, &backup_dst)
            .await
            .map_err(|e| e.to_string())?;
    }

    if let Err(rename_error) = fs::rename(&temp_dst, &dst).await {
        if had_existing_snapshot && backup_dst.exists() {
            let _ = fs::rename(&backup_dst, &dst).await;
        }
        if temp_dst.exists() {
            let _ = fs::remove_dir_all(&temp_dst).await;
        }
        return Err(rename_error.to_string());
    }

    if had_existing_snapshot && backup_dst.exists() {
        fs::remove_dir_all(&backup_dst)
            .await
            .map_err(|e| e.to_string())?;
    }

    Ok(SnapshotResult {
        file_count,
        total_bytes,
        snapshot_time,
    })
}

async fn restore_sessions_inner(
    app: &AppHandle,
    account_id: &str,
) -> Result<RestoreResult, String> {
    let dst = live_sessions_dir()?;
    let src = account_snapshot_dir(app, account_id)?;

    // Clear live sessions
    if dst.exists() {
        fs::remove_dir_all(&dst).await.map_err(|e| e.to_string())?;
    }
    fs::create_dir_all(&dst).await.map_err(|e| e.to_string())?;

    let restore_time = chrono::Utc::now().to_rfc3339();

    if !src.exists() {
        // No snapshot — just leave sessions empty
        return Ok(RestoreResult {
            file_count: 0,
            total_bytes: 0,
            restore_time,
        });
    }

    let src_clone = src.clone();
    let dst_clone = dst.clone();
    let (file_count, total_bytes) =
        tokio::task::spawn_blocking(move || copy_dir_recursive(&src_clone, &dst_clone))
            .await
            .map_err(|e| e.to_string())?
            .map_err(|e| e.to_string())?;

    Ok(RestoreResult {
        file_count,
        total_bytes,
        restore_time,
    })
}

async fn write_auth_json_inner(content: &str) -> Result<(), String> {
    let path = home_codex_dir()?.join("auth.json");
    write_text_atomic_async(path, content.to_string()).await
}

// ─── Tauri commands ───────────────────────────────────────────────────────────

#[tauri::command]
pub async fn snapshot_sessions(
    app: AppHandle,
    account_id: String,
) -> Result<SnapshotResult, String> {
    snapshot_sessions_inner(&app, &account_id).await
}

#[tauri::command]
pub async fn restore_sessions(app: AppHandle, account_id: String) -> Result<RestoreResult, String> {
    restore_sessions_inner(&app, &account_id).await
}

#[tauri::command]
pub async fn switch_account(
    _app: AppHandle,
    lock: tauri::State<'_, crate::SwitchLock>,
    _from_id: Option<String>,
    _to_id: String,
    to_auth: String,
) -> Result<SwitchResult, String> {
    let _guard = lock.0.lock().await; // serialize all switch operations
    let sessions_dir = live_sessions_dir()?;
    let snapshot_time = chrono::Utc::now().to_rfc3339();
    let snapshot_dir = sessions_dir.clone();
    let (snapshot_file_count, snapshot_total_bytes) =
        tokio::task::spawn_blocking(move || count_dir(&snapshot_dir))
            .await
            .map_err(|e| e.to_string())?;

    let snapshot = SnapshotResult {
        file_count: snapshot_file_count,
        total_bytes: snapshot_total_bytes,
        snapshot_time,
    };

    // Switching accounts now preserves the shared ~/.codex/sessions store and only swaps auth.json.
    let current_auth_backup = fs::read_to_string(home_codex_dir()?.join("auth.json"))
        .await
        .ok();

    if let Err(e) = write_auth_json_inner(&to_auth).await {
        if let Some(backup) = current_auth_backup {
            let _ = write_auth_json_inner(&backup).await;
        }
        return Err(format!("Write auth failed: {}", e));
    }

    let restore_time = chrono::Utc::now().to_rfc3339();
    let restore_dir = sessions_dir.clone();
    let (restore_file_count, restore_total_bytes) =
        tokio::task::spawn_blocking(move || count_dir(&restore_dir))
            .await
            .map_err(|e| e.to_string())?;

    let restore = RestoreResult {
        file_count: restore_file_count,
        total_bytes: restore_total_bytes,
        restore_time,
    };

    Ok(SwitchResult {
        success: true,
        snapshot,
        restore,
        error: None,
    })
}

#[tauri::command]
pub async fn list_account_session_info(
    app: AppHandle,
    account_id: String,
) -> Result<Option<SessionInfo>, String> {
    let snapshot_dir = account_snapshot_dir(&app, &account_id)?;
    let meta_path = snapshot_dir.join(".snapshot_meta.json");

    if !meta_path.exists() {
        return Ok(None);
    }

    let content = fs::read_to_string(&meta_path)
        .await
        .map_err(|e| e.to_string())?;
    let meta: SnapshotMeta = serde_json::from_str(&content).map_err(|e| e.to_string())?;

    Ok(Some(SessionInfo {
        file_count: meta.file_count,
        total_bytes: meta.total_bytes,
        last_session_observed_at: Some(meta.snapshot_at),
        current_session_id: None,
        current_thread_name: None,
        current_updated_at: None,
    }))
}

#[tauri::command]
pub async fn get_current_sessions_info() -> Result<SessionInfo, String> {
    let sessions_dir = live_sessions_dir()?;
    let dir_clone = sessions_dir.clone();
    let (file_count, total_bytes) = tokio::task::spawn_blocking(move || count_dir(&dir_clone))
        .await
        .map_err(|e| e.to_string())?;
    let latest_session = latest_shared_session().await?;

    Ok(SessionInfo {
        file_count,
        total_bytes,
        last_session_observed_at: None,
        current_session_id: latest_session.as_ref().map(|entry| entry.id.clone()),
        current_thread_name: latest_session
            .as_ref()
            .and_then(|entry| entry.thread_name.clone()),
        current_updated_at: latest_session
            .as_ref()
            .and_then(|entry| entry.updated_at.clone()),
    })
}

#[tauri::command]
pub async fn read_usage_stats_summary() -> Result<UsageStatsSummary, String> {
    read_usage_stats_summary_inner().await
}

#[tauri::command]
pub async fn delete_account_sessions(app: AppHandle, account_id: String) -> Result<(), String> {
    let path = account_snapshot_dir(&app, &account_id)?;
    if path.exists() {
        fs::remove_dir_all(&path).await.map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{extract_token_usage, EventMessagePayload};

    #[test]
    fn parses_snake_case_token_count_payload() {
        let payload = r#"{
            "type": "token_count",
            "info": {
                "total_token_usage": {
                    "input_tokens": 100,
                    "cached_input_tokens": 25,
                    "output_tokens": 10,
                    "reasoning_output_tokens": 5,
                    "total_tokens": 110
                },
                "last_token_usage": {
                    "input_tokens": 20,
                    "cached_input_tokens": 5,
                    "output_tokens": 2,
                    "reasoning_output_tokens": 1,
                    "total_tokens": 22
                }
            }
        }"#;

        let parsed: EventMessagePayload = serde_json::from_str(payload).expect("payload should parse");
        let usage = extract_token_usage(parsed.info.expect("token info should exist"))
            .expect("usage should be extracted");

        assert_eq!(usage.total_tokens, 110);
        assert_eq!(usage.input_tokens, 100);
    }
}
