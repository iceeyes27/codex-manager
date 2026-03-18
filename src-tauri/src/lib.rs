pub mod commands;
pub mod models;

use commands::{accounts, oauth, paths, sessions, usage};

/// Global mutex to serialize all operations that mutate live session/auth files,
/// preventing concurrent switches from interleaving and corrupting isolation.
#[derive(Default)]
pub struct SwitchLock(pub tokio::sync::Mutex<()>);

pub fn run() {
    tauri::Builder::default()
        .manage(SwitchLock::default())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            // paths
            paths::get_codex_dir,
            paths::get_sessions_dir,
            paths::get_account_sessions_dir,
            // accounts
            accounts::load_accounts,
            accounts::save_accounts,
            accounts::load_settings,
            accounts::save_settings,
            accounts::read_auth_json,
            accounts::write_auth_json,
            accounts::save_account_credentials,
            accounts::read_account_credentials,
            accounts::delete_account_credentials,
            // sessions
            sessions::snapshot_sessions,
            sessions::restore_sessions,
            sessions::switch_account,
            sessions::list_account_session_info,
            sessions::get_current_sessions_info,
            sessions::delete_account_sessions,
            usage::read_account_rate_limits,
            // oauth
            oauth::start_oauth_flow,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
