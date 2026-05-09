use crate::models::AppSettings;

fn env_proxy_url() -> Option<String> {
    [
        "HTTPS_PROXY",
        "https_proxy",
        "ALL_PROXY",
        "all_proxy",
        "HTTP_PROXY",
        "http_proxy",
    ]
    .iter()
    .filter_map(|key| std::env::var(key).ok())
    .map(|value| value.trim().to_string())
    .find(|value| !value.is_empty())
}

fn add_default_scheme(value: &str, scheme: &str) -> String {
    if value.contains("://") {
        value.to_string()
    } else {
        format!("{scheme}://{value}")
    }
}

fn parse_proxy_server_entry(proxy_server: &str) -> Option<String> {
    let trimmed = proxy_server.trim();
    if trimmed.is_empty() {
        return None;
    }

    if !trimmed.contains(';') && !trimmed.contains('=') {
        return Some(add_default_scheme(trimmed, "http"));
    }

    let mut http_proxy = None;
    let mut socks_proxy = None;

    for part in trimmed
        .split(';')
        .map(str::trim)
        .filter(|part| !part.is_empty())
    {
        let Some((raw_kind, raw_value)) = part.split_once('=') else {
            continue;
        };
        let kind = raw_kind.trim().to_ascii_lowercase();
        let value = raw_value.trim();
        if value.is_empty() {
            continue;
        }

        match kind.as_str() {
            "https" => return Some(add_default_scheme(value, "http")),
            "http" => http_proxy = Some(add_default_scheme(value, "http")),
            "socks" | "socks5" => socks_proxy = Some(add_default_scheme(value, "socks5")),
            _ => {}
        }
    }

    http_proxy.or(socks_proxy)
}

#[cfg(target_os = "windows")]
fn windows_system_proxy_url() -> Option<String> {
    use winreg::{enums::HKEY_CURRENT_USER, RegKey};

    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let settings = hkcu
        .open_subkey("Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings")
        .ok()?;
    let enabled = settings.get_value::<u32, _>("ProxyEnable").unwrap_or(0);
    if enabled == 0 {
        return None;
    }

    let proxy_server = settings.get_value::<String, _>("ProxyServer").ok()?;
    parse_proxy_server_entry(&proxy_server)
}

#[cfg(not(target_os = "windows"))]
fn windows_system_proxy_url() -> Option<String> {
    None
}

fn configured_proxy_url(settings: &AppSettings) -> Option<String> {
    let explicit = settings.proxy_url.trim();
    if !explicit.is_empty() {
        return Some(explicit.to_string());
    }

    env_proxy_url().or_else(windows_system_proxy_url)
}

pub fn build_http_client(
    settings: &AppSettings,
    user_agent: &str,
    timeout: std::time::Duration,
) -> Result<reqwest::Client, String> {
    let mut builder = reqwest::Client::builder()
        .user_agent(user_agent)
        .timeout(timeout);

    if let Some(proxy_url) = configured_proxy_url(settings) {
        let proxy = reqwest::Proxy::all(&proxy_url)
            .map_err(|e| format!("Invalid proxy URL {proxy_url}: {e}"))?;
        builder = builder.proxy(proxy);
    }

    builder
        .build()
        .map_err(|e| format!("创建 HTTP 客户端失败: {e}"))
}

#[cfg(test)]
mod tests {
    use super::parse_proxy_server_entry;

    #[test]
    fn parses_single_proxy_server() {
        assert_eq!(
            parse_proxy_server_entry("127.0.0.1:7890").as_deref(),
            Some("http://127.0.0.1:7890")
        );
    }

    #[test]
    fn prefers_https_proxy_server_entry() {
        assert_eq!(
            parse_proxy_server_entry("http=127.0.0.1:7890;https=127.0.0.1:7891").as_deref(),
            Some("http://127.0.0.1:7891")
        );
    }

    #[test]
    fn parses_socks_proxy_server_entry() {
        assert_eq!(
            parse_proxy_server_entry("socks=127.0.0.1:1080").as_deref(),
            Some("socks5://127.0.0.1:1080")
        );
    }
}
