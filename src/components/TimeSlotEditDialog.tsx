import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Box,
  Typography
} from '@mui/material';
import { Save } from 'lucide-react';

type TimeSlotEditDialogProps = {
  open: boolean;
  onClose: () => void;
  startTime: string;
  endTime: string;
  onStartTimeChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onEndTimeChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSave: () => void;
  isEditing: boolean;
  dayLabel?: string; // Optional: name of the day (e.g. "Mån")
};

const TimeSlotEditDialog: React.FC<TimeSlotEditDialogProps> = ({
  open,
  onClose,
  startTime,
  endTime,
  onStartTimeChange,
  onEndTimeChange,
  onSave,
  isEditing,
  dayLabel
}) => {
  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>
        {isEditing ? 'Redigera tidslucka' : 'Lägg till tidslucka'}
      </DialogTitle>
      <DialogContent>
        {dayLabel && (
          <Typography variant="subtitle1" sx={{ mb: 2 }}>
            Dag: <strong>{dayLabel}</strong>
          </Typography>
        )}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          <TextField
            label="Starttid"
            type="time"
            value={startTime}
            onChange={onStartTimeChange}
            InputLabelProps={{ shrink: true }}
            inputProps={{ step: 300 }}
            fullWidth
          />
          <TextField
            label="Sluttid"
            type="time"
            value={endTime}
            onChange={onEndTimeChange}
            InputLabelProps={{ shrink: true }}
            inputProps={{ step: 300 }}
            fullWidth
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Avbryt</Button>
        <Button
          onClick={onSave}
          variant="contained"
          startIcon={<Save size={18} />}
        >
          Spara
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default TimeSlotEditDialog;
