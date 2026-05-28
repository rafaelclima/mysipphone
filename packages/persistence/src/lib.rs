pub mod error;
pub mod migrations;
pub mod models;
pub mod repositories;

pub use error::PersistenceError;


use rusqlite::Connection;
use std::sync::Mutex;

pub struct Database {
    conn: Mutex<Connection>,
}

impl Database {
    pub fn open(path: &str) -> Result<Self, PersistenceError> {
        let conn = Connection::open(path)?;
        let db = Self {
            conn: Mutex::new(conn),
        };
        db.run_migrations()?;
        Ok(db)
    }

    pub fn open_in_memory() -> Result<Self, PersistenceError> {
        let conn = Connection::open_in_memory()?;
        let db = Self {
            conn: Mutex::new(conn),
        };
        db.run_migrations()?;
        Ok(db)
    }

    fn run_migrations(&self) -> Result<(), PersistenceError> {
        let conn = self.conn.lock().map_err(|e| PersistenceError::Internal(e.to_string()))?;
        migrations::run_migrations(&conn)?;
        Ok(())
    }

    pub fn connection(&self) -> std::sync::MutexGuard<'_, Connection> {
        self.conn.lock().expect("Database mutex poisoned")
    }
}
