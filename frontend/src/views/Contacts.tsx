import { useState } from "react";
import {
  Box,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  Typography,
  TextField,
  InputAdornment,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import PhoneIcon from "@mui/icons-material/Phone";
import { useContactStore } from "../store/useContactStore";

function Contacts() {
  const contacts = useContactStore((s) => s.contacts);
  const [search, setSearch] = useState("");

  const filtered = contacts.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.sipUri.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <Box>
      <Typography variant="h6" sx={{ mb: 1 }}>
        Contacts
      </Typography>

      <TextField
        fullWidth
        size="small"
        placeholder="Search contacts..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          },
        }}
        sx={{ mb: 1 }}
      />

      <List sx={{ py: 0 }}>
        {filtered.map((contact) => (
          <ListItem
            key={contact.id}
            sx={{
              borderRadius: 2,
              mb: 0.5,
              "&:hover": { bgcolor: "action.hover" },
            }}
          >
            <ListItemAvatar>
              <Avatar sx={{ bgcolor: "primary.main" }}>
                {contact.name.charAt(0)}
              </Avatar>
            </ListItemAvatar>
            <ListItemText
              primary={contact.name}
              secondary={contact.sipUri}
              primaryTypographyProps={{ fontWeight: 500 }}
            />
            <Box
              component="span"
              sx={{
                display: "flex",
                alignItems: "center",
                color: "success.main",
              }}
            >
              <PhoneIcon fontSize="small" />
            </Box>
          </ListItem>
        ))}
      </List>

      {filtered.length === 0 && (
        <Typography color="text.secondary" sx={{ textAlign: "center", mt: 4 }}>
          No contacts found
        </Typography>
      )}
    </Box>
  );
}

export default Contacts;
