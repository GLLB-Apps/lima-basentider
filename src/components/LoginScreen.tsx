import React from 'react';
import { 
  Dialog, 
  DialogTitle, 
  DialogContent, 
  DialogActions, 
  TextField, 
  Button, 
  Alert 
} from '@mui/material';

type LoginDialogProps = {
  open: boolean;
  onClose: () => void;
  username: string;
  password: string;
  error: string;
  onUsernameChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onPasswordChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onLogin: () => void;
};

const LoginDialog: React.FC<LoginDialogProps> = ({
  open,
  onClose,
  username,
  password,
  error,
  onUsernameChange,
  onPasswordChange,
  onLogin
}) => {
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      onLogin();
    }
  };

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>Logga in</DialogTitle>
      <DialogContent>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <TextField
          autoFocus
          margin="dense"
          label="Användarnamn"
          type="text"
          fullWidth
          variant="outlined"
          value={username}
          onChange={onUsernameChange}
          sx={{ mb: 2 }}
          onKeyPress={handleKeyPress}
        />
        <TextField
          margin="dense"
          label="Lösenord"
          type="password"
          fullWidth
          variant="outlined"
          value={password}
          onChange={onPasswordChange}
          onKeyPress={handleKeyPress}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Avbryt</Button>
        <Button onClick={onLogin} variant="contained">Logga in</Button>
      </DialogActions>
    </Dialog>
  );
};

export default LoginDialog;