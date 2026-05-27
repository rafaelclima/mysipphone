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
            Ok(shared::AccountConfig {
                id: row.get(0)?,
                display_name: row.get(1)?,
                sip_uri: row.get(2)?,
                registrar: row.get(3)?,
                username: row.get(4)?,
                password: row.get(5)?,
                realm: row.get(6)?,
                transport: shared::SipTransport::Udp,
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
            "INSERT INTO call_log (id, remote_uri, remote_name, direction, start_time, duration_secs, end_reason)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                entry.id,
                entry.remote_uri,
                entry.remote_name,
                format!("{:?}", entry.direction),
                entry.start_time,
                entry.duration_secs,
                format!("{:?}", entry.end_reason),
            ],
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
            Ok(shared::CallLogEntry {
                id: row.get(0)?,
                remote_uri: row.get(1)?,
                remote_name: row.get(2)?,
                direction: shared::CallDirection::Outgoing,
                start_time: row.get(4)?,
                duration_secs: row.get(5)?,
                end_reason: shared::CallEndReason::Unknown,
            })
        })?;
        entries.collect::<Result<Vec<_>, _>>().map_err(Into::into)
    }
}
