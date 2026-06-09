use crate::Database;
use crate::PersistenceError;
use rusqlite::params;

/// Keyring service name for SIP passwords.
const KEYRING_SERVICE: &str = "mysipphone";

fn keyring_user(account_id: &str) -> String {
    format!("sip:{}", account_id)
}

fn password_from_keyring(account_id: &str) -> Result<String, PersistenceError> {
    let entry = keyring::Entry::new(KEYRING_SERVICE, &keyring_user(account_id))?;
    entry.get_password().map_err(Into::into)
}

fn password_to_keyring(account_id: &str, password: &str) -> Result<(), PersistenceError> {
    let entry = keyring::Entry::new(KEYRING_SERVICE, &keyring_user(account_id))?;
    entry.set_password(password).map_err(Into::into)
}

#[allow(dead_code)]
fn password_delete_from_keyring(account_id: &str) -> Result<(), PersistenceError> {
    let entry = keyring::Entry::new(KEYRING_SERVICE, &keyring_user(account_id))?;
    entry.delete_credential().ok();
    Ok(())
}

impl Database {
    pub fn save_account(
        &self,
        account: &shared::AccountConfig,
    ) -> Result<(), PersistenceError> {
        // Try OS keyring (Secret Service / GNOME Keyring / KDE Wallet).
        // If unavailable (headless, COSMIC w/o gnome-keyring, etc.), fall
        // back to SQLite storage with a warning. The password column is
        // always written — either as `""` (keyring ok) or the actual value.
        let use_keyring = if !account.password.is_empty() {
            match password_to_keyring(&account.id, &account.password) {
                Ok(_) => true,
                Err(e) => {
                    tracing::warn!("Keyring unavailable, storing password in SQLite: {e}");
                    false
                }
            }
        } else {
            false
        };
        let conn = self.connection();
        conn.execute(
            "INSERT OR REPLACE INTO accounts (id, display_name, sip_uri, registrar, username, password, realm, transport, is_active)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            params![
                account.id,
                account.display_name,
                account.sip_uri,
                account.registrar,
                account.username,
                if use_keyring { "" } else { &account.password },
                account.realm,
                format!("{:?}", account.transport),
                true,
            ],
        )?;
        Ok(())
    }

    pub fn get_all_accounts(&self) -> Result<Vec<shared::AccountConfig>, PersistenceError> {
        let conn = self.connection();
        let mut stmt = conn.prepare(
            "SELECT id, display_name, sip_uri, registrar, username, password, realm, transport FROM accounts WHERE is_active = 1",
        )?;
        let accounts = stmt.query_map([], |row| {
            let transport_str: String = row.get(7)?;
            let transport = match transport_str.to_lowercase().as_str() {
                "tcp" => shared::SipTransport::Tcp,
                "tls" => shared::SipTransport::Tls,
                _ => shared::SipTransport::Udp,
            };
            let account_id: String = row.get(0)?;
            let sql_password: String = row.get(5)?;
            let password = if sql_password.is_empty() {
                // Password was stored in keyring — try to retrieve it.
                // If keyring is unavailable, return empty (user must re-enter).
                password_from_keyring(&account_id).unwrap_or_else(|e| {
                    tracing::warn!("Keyring unavailable, password empty for {}: {e}", account_id);
                    String::new()
                })
            } else {
                // Legacy: password still in SQLite (keyring was unavailable
                // at save time, or account predates keyring integration).
                // Attempt one-time migration to keyring on read.
                if let Err(e) = password_to_keyring(&account_id, &sql_password) {
                    tracing::warn!("Could not migrate password to keyring: {e}");
                }
                sql_password
            };
            Ok(shared::AccountConfig {
                id: account_id,
                display_name: row.get(1)?,
                sip_uri: row.get(2)?,
                registrar: row.get(3)?,
                username: row.get(4)?,
                password,
                realm: row.get(6)?,
                transport,
            })
        })?;
        accounts.collect::<Result<Vec<_>, _>>().map_err(Into::into)
    }

    pub fn save_contact(&self, contact: &shared::Contact) -> Result<(), PersistenceError> {
        let conn = self.connection();
        conn.execute(
            "INSERT OR REPLACE INTO contacts (id, name, sip_uri, phone_number, avatar_url)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            params![contact.id, contact.name, contact.sip_uri, contact.phone_number, contact.avatar_url],
        )?;
        Ok(())
    }

    pub fn delete_contact(&self, id: &str) -> Result<(), PersistenceError> {
        let conn = self.connection();
        conn.execute("DELETE FROM contacts WHERE id = ?1", params![id])?;
        Ok(())
    }

    pub fn get_all_contacts(&self) -> Result<Vec<shared::Contact>, PersistenceError> {
        let conn = self.connection();
        let mut stmt = conn.prepare(
            "SELECT id, name, sip_uri, phone_number, avatar_url FROM contacts ORDER BY name ASC",
        )?;
        let contacts = stmt.query_map([], |row| {
            Ok(shared::Contact {
                id: row.get(0)?,
                name: row.get(1)?,
                sip_uri: row.get(2)?,
                phone_number: row.get(3)?,
                avatar_url: row.get(4)?,
            })
        })?;
        contacts.collect::<Result<Vec<_>, _>>().map_err(Into::into)
    }

    pub fn save_call_log(
        &self,
        entry: &shared::CallLogEntry,
    ) -> Result<(), PersistenceError> {
        let conn = self.connection();
        conn.execute(
            "INSERT OR REPLACE INTO call_log (id, remote_uri, remote_name, direction, start_time, duration_secs, end_reason)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                entry.id,
                entry.remote_uri,
                entry.remote_name,
                serde_json::to_string(&entry.direction).map(|s| s.trim_matches('"').to_string()).unwrap_or_default(),
                entry.start_time,
                entry.duration_secs,
                serde_json::to_string(&entry.end_reason).map(|s| s.trim_matches('"').to_string()).unwrap_or_default(),
            ],
        )?;
        drop(conn);
        self.prune_call_logs()?;
        Ok(())
    }

    pub fn prune_call_logs(&self) -> Result<(), PersistenceError> {
        let conn = self.connection();
        conn.execute(
            "DELETE FROM call_log WHERE created_at < datetime('now', '-7 days')",
            [],
        )?;
        Ok(())
    }

    pub fn get_call_history(
        &self,
        limit: u32,
    ) -> Result<Vec<shared::CallLogEntry>, PersistenceError> {
        let conn = self.connection();
        let mut stmt = conn.prepare(
            "SELECT id, remote_uri, remote_name, direction, start_time, duration_secs, end_reason
             FROM call_log ORDER BY start_time DESC LIMIT ?1",
        )?;
        let entries = stmt.query_map(params![limit], |row| {
            let dir_str: String = row.get(3)?;
            let direction: shared::CallDirection = dir_str.parse().unwrap_or(shared::CallDirection::Outgoing);
            let reason_str: String = row.get(6)?;
            let end_reason: shared::CallEndReason = reason_str.parse().unwrap_or(shared::CallEndReason::Unknown);
            Ok(shared::CallLogEntry {
                id: row.get(0)?,
                remote_uri: row.get(1)?,
                remote_name: row.get(2)?,
                direction,
                start_time: row.get(4)?,
                duration_secs: row.get(5)?,
                end_reason,
            })
        })?;
        entries.collect::<Result<Vec<_>, _>>().map_err(Into::into)
    }
}
