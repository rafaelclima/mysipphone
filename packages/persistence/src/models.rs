use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AccountRow {
    pub id: String,
    pub display_name: String,
    pub sip_uri: String,
    pub registrar: String,
    pub username: String,
    pub password: String,
    pub realm: String,
    pub transport: String,
    pub is_active: bool,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContactRow {
    pub id: String,
    pub name: String,
    pub sip_uri: String,
    pub phone_number: Option<String>,
    pub avatar_url: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CallLogRow {
    pub id: String,
    pub remote_uri: String,
    pub remote_name: String,
    pub direction: String,
    pub start_time: String,
    pub end_time: Option<String>,
    pub duration_secs: u64,
    pub end_reason: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SettingRow {
    pub key: String,
    pub value: String,
}
