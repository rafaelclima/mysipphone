use crate::Database;
use crate::PersistenceError;
use rusqlite::params;

impl Database {
    pub fn save_account(
        &self,
        account: &shared::AccountConfig,
    ) -> Result<(), PersistenceError> {
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
                account.password,
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
            Ok(shared::AccountConfig {
                id: row.get(0)?,
                display_name: row.get(1)?,
                sip_uri: row.get(2)?,
                registrar: row.get(3)?,
                username: row.get(4)?,
                password: row.get(5)?,
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
