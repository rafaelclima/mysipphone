use thiserror::Error;

#[derive(Error, Debug)]
pub enum PersistenceError {
    #[error("SQLite error: {0}")]
    Sqlite(#[from] rusqlite::Error),

    #[error("Serialization error: {0}")]
    Serialization(String),

    #[error("Not found")]
    NotFound,

    #[error("Internal error: {0}")]
    Internal(String),
}
