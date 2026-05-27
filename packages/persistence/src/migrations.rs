use rusqlite::Connection;

pub fn run_migrations(conn: &Connection) -> Result<(), crate::PersistenceError> {
    conn.execute_batch(
        "
        CREATE TABLE IF NOT EXISTS schema_version (
            version INTEGER PRIMARY KEY
        );

        CREATE TABLE IF NOT EXISTS accounts (
            id TEXT PRIMARY KEY,
            display_name TEXT NOT NULL DEFAULT '',
            sip_uri TEXT NOT NULL,
            registrar TEXT NOT NULL DEFAULT '',
            username TEXT NOT NULL,
            password TEXT NOT NULL DEFAULT '',
            realm TEXT NOT NULL DEFAULT '*',
            transport TEXT NOT NULL DEFAULT 'Udp',
            is_active INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS contacts (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            sip_uri TEXT NOT NULL,
            phone_number TEXT,
            avatar_url TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS call_log (
            id TEXT PRIMARY KEY,
            remote_uri TEXT NOT NULL,
            remote_name TEXT NOT NULL DEFAULT '',
            direction TEXT NOT NULL,
            start_time TEXT NOT NULL,
            end_time TEXT,
            duration_secs INTEGER NOT NULL DEFAULT 0,
            end_reason TEXT NOT NULL DEFAULT 'Unknown',
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS audio_preferences (
            id TEXT PRIMARY KEY,
            device_id TEXT NOT NULL,
            device_type TEXT NOT NULL,
            is_active INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        ",
    )?;

    Ok(())
}
