import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Typography,
  Chip,
  Paper,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  Snackbar,
  Alert,
  CircularProgress
} from '@mui/material';
import {
  Clock,
  Plus,
  Edit,
  Trash2,
  User as UserIcon,
  Image as ImageIcon
} from 'lucide-react';

import { DaySchedule, TimeSlot, User } from '../types';
import { timeToMinutes } from '../utils';
import MulberrySymbols from './MulberrySymbolPicker';
import { uploadSymbol, getSymbolUrl } from '../services/appwriteService';

interface Symbol {
  id: string;
  name: string;
  image_url: string;
  svg?: string;
}

type ScheduleScreenProps = {
  currentDay: string;
  currentTime: string;
  currentTimeMinutes: number;
  nextOpening: { day: string; time: string; minutesUntil: number };
  scheduleData: DaySchedule[];
  isLoggedIn: boolean;
  isAdmin: boolean;
  currentUser: User | null;
  handleAddTimeSlot: (dayId: string) => void;
  handleEditTimeSlot: (dayId: string, timeSlot: TimeSlot) => void;
  handleDeleteTimeSlot: (dayId: string, timeSlotId: string) => void;
  openSymbolMessage?: string;
  closedSymbolMessage?: string;
  onSymbolUpdate?: (type: 'open' | 'closed', symbol: Symbol) => void;
};

const ScheduleScreen: React.FC<ScheduleScreenProps> = ({
  currentDay,
  currentTime,
  currentTimeMinutes,
  nextOpening,
  scheduleData,
  isLoggedIn,
  isAdmin,
  currentUser,
  handleAddTimeSlot,
  handleEditTimeSlot,
  handleDeleteTimeSlot,
  openSymbolMessage = 'Vi har öppet',
  closedSymbolMessage = 'Vi har stängt',
  onSymbolUpdate
}) => {
  const weekdayOrder = ['Mån', 'Tis', 'Ons', 'Tors', 'Fre', 'Lör', 'Sön'];
  const sortedScheduleData = [...scheduleData].sort((a, b) => weekdayOrder.indexOf(a.day) - weekdayOrder.indexOf(b.day));

  const [openSymbol, setOpenSymbol] = useState<Symbol | null>(null);
  const [closedSymbol, setClosedSymbol] = useState<Symbol | null>(null);
  const [symbolPickerOpen, setSymbolPickerOpen] = useState(false);
  const [selectingFor, setSelectingFor] = useState<'open' | 'closed'>('open');
  
  const [isUploading, setIsUploading] = useState(false);
  const [notification, setNotification] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'info';
  }>({ open: false, message: '', severity: 'info' });

  // Fetch saved symbols on component mount
  useEffect(() => {
    const loadSymbols = async () => {
      try {
        // Get open symbol URL
        const openUrl = getSymbolUrl('open');
        if (openUrl) {
          const openSymbolObj = {
            id: 'open',
            name: 'Open Symbol',
            image_url: openUrl + '&timestamp=' + Date.now()
          };
          setOpenSymbol(openSymbolObj);
        }

        // Get closed symbol URL
        const closedUrl = getSymbolUrl('closed');
        if (closedUrl) {
          const closedSymbolObj = {
            id: 'closed',
            name: 'Closed Symbol',
            image_url: closedUrl + '&timestamp=' + Date.now()
          };
          setClosedSymbol(closedSymbolObj);
        }
      } catch (err) {
        console.error('Error loading saved symbols:', err);
      }
    };

    if (isLoggedIn) {
      loadSymbols();
    }
  }, [isLoggedIn]);

  const handleOpenSymbolPicker = (type: 'open' | 'closed') => {
    setSelectingFor(type);
    setSymbolPickerOpen(true);
  };

  // Handle completion of the symbol selection and upload process
  const handleSymbolCompleted = (data: { svgString: string; id?: string; message: string; url: string }) => {
    // Create a symbol object from the completed data
    const symbol: Symbol = {
      id: data.id || selectingFor,
      name: data.id || (selectingFor === 'open' ? 'Open Symbol' : 'Closed Symbol'),
      image_url: data.url + '&timestamp=' + Date.now(),
      svg: data.svgString
    };
    
    // Update the appropriate symbol state
    if (selectingFor === 'open') {
      setOpenSymbol(symbol);
    } else {
      setClosedSymbol(symbol);
    }
    
    // Notify parent component about the symbol update
    if (onSymbolUpdate) {
      onSymbolUpdate(selectingFor, symbol);
    }
    
    // Show success notification
    setNotification({
      open: true,
      message: `${selectingFor === 'open' ? 'Open' : 'Closed'} symbol saved successfully!`,
      severity: 'success'
    });
    
    // Close the dialog
    setSymbolPickerOpen(false);
  };

  const handleCloseNotification = () => {
    setNotification({ ...notification, open: false });
  };

  const handleCloseDialog = () => {
    setSymbolPickerOpen(false);
  };

  return (
    <Container maxWidth="md" sx={{ mt: 2 }}>
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'center' }}>
        <Chip icon={<Clock size={16} />} label={`${currentDay} ${currentTime}`} color="primary" variant="outlined" />
      </Box>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Schema
        </Typography>
        {isLoggedIn && (
          <Chip icon={<UserIcon size={16} />} label={`${currentUser?.name}`} color="primary" sx={{ ml: 2 }} />
        )}
      </Box>

      <Box sx={{ display: { xs: 'block', md: 'none' } }}>
        {sortedScheduleData.map((day) => (
          <DayCard
            key={day.id}
            {...{ day, currentDay, currentTimeMinutes, nextOpening, isLoggedIn, handleAddTimeSlot, handleEditTimeSlot, handleDeleteTimeSlot, openSymbol, closedSymbol }}
          />
        ))}
      </Box>

      <Box sx={{ display: { xs: 'none', md: 'flex' }, gap: 2, flexWrap: 'wrap', justifyContent: 'center' }}>
        {sortedScheduleData.map((day) => (
          <Box key={day.id} sx={{ width: 'calc(25% - 16px)', minWidth: '150px' }}>
            <DayCard
              {...{ day, currentDay, currentTimeMinutes, nextOpening, isLoggedIn, handleAddTimeSlot, handleEditTimeSlot, handleDeleteTimeSlot, openSymbol, closedSymbol }}
            />
          </Box>
        ))}
      </Box>

      {isLoggedIn && (
        <Paper elevation={3} sx={{ mt: 4, p: 2 }}>
          <Typography variant="h6" gutterBottom>Konfigurering av symboler</Typography>
          <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 3, mt: 2 }}>
            {[{ type: 'open', symbol: openSymbol, bg: 'rgba(0, 255, 8, 0.1)' }, { type: 'closed', symbol: closedSymbol, bg: 'rgba(255, 0, 0, 0.1)' }].map(({ type, symbol, bg }) => (
              <Box key={type} sx={{ flex: 1, position: 'relative' }}>
                <Typography variant="subtitle1" gutterBottom>{type === 'open' ? 'Öppet symbol' : 'Stängt symbol'}</Typography>
                <Paper
                  sx={{ 
                    display: 'flex', 
                    flexDirection: 'column', 
                    alignItems: 'center', 
                    p: 2, 
                    height: 120, 
                    width: '100%', 
                    backgroundColor: bg, 
                    cursor: isUploading ? 'default' : 'pointer',
                    opacity: isUploading && selectingFor === type ? 0.7 : 1
                  }}
                  onClick={() => !isUploading && handleOpenSymbolPicker(type as 'open' | 'closed')}
                >
                  {isUploading && selectingFor === type && (
                    <Box sx={{ 
                      position: 'absolute', 
                      top: 0, 
                      left: 0, 
                      right: 0, 
                      bottom: 0, 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      backgroundColor: 'rgba(255,255,255,0.7)',
                      zIndex: 2
                    }}>
                      <CircularProgress size={40} />
                    </Box>
                  )}
                  
                  {symbol ? (
                    <>
                      <Box component="img" src={symbol.image_url} alt={symbol.name} sx={{ height: 60, mb: 1 }} />
                      <Typography variant="caption" textAlign="center">{symbol.name}</Typography>
                    </>
                  ) : (
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                      <ImageIcon size={40} style={{ marginBottom: 8, opacity: 0.6 }} />
                      <Typography>Välj {type === 'open' ? 'öppet' : 'stängt'} symbol</Typography>
                    </Box>
                  )}
                </Paper>
              </Box>
            ))}
          </Box>
        </Paper>
      )}

      <Dialog 
        open={symbolPickerOpen} 
        maxWidth="md" 
        fullWidth
      >
        <DialogTitle>Välj {selectingFor === 'open' ? 'öppet' : 'stängt'} symbol</DialogTitle>
        <DialogContent>
          <MulberrySymbols
            sourceUrl="/symbols/icons.html"
            symbolType={selectingFor}
            onCompleted={handleSymbolCompleted}
            onClose={handleCloseDialog}
          />
        </DialogContent>
      </Dialog>

      <Snackbar
        open={notification.open}
        autoHideDuration={6000}
        onClose={handleCloseNotification}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={handleCloseNotification} severity={notification.severity} sx={{ width: '100%' }}>
          {notification.message}
        </Alert>
      </Snackbar>
    </Container>
  );
};

export default ScheduleScreen;

const DayCard = ({
  day,
  currentDay,
  currentTimeMinutes,
  nextOpening,
  isLoggedIn,
  handleAddTimeSlot,
  handleEditTimeSlot,
  handleDeleteTimeSlot,
  openSymbol,
  closedSymbol
}: {
  day: DaySchedule;
  currentDay: string;
  currentTimeMinutes: number;
  nextOpening: { day: string; time: string; minutesUntil: number };
  isLoggedIn: boolean;
  handleAddTimeSlot: (dayId: string) => void;
  handleEditTimeSlot: (dayId: string, timeSlot: TimeSlot) => void;
  handleDeleteTimeSlot: (dayId: string, timeSlotId: string) => void;
  openSymbol: Symbol | null;
  closedSymbol: Symbol | null;
}) => {
  const hasCurrentTimeSlot = day.times.some(time => currentDay === day.day && currentTimeMinutes >= timeToMinutes(time.start) && currentTimeMinutes < timeToMinutes(time.end));

  // Determine which symbol to show based on whether the place is currently open
  const symbolToShow = hasCurrentTimeSlot ? openSymbol : closedSymbol;

  return (
    <Paper elevation={currentDay === day.day ? 5 : 2} sx={{ bgcolor: day.color, mb: 2, overflow: 'hidden', border: currentDay === day.day ? '2px solid #1976d2' : 'none' }}>
      <Box sx={{ py: 1, bgcolor: 'rgba(0,0,0,0.15)', textAlign: 'center', display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 'bold', color: 'rgba(0,0,0,0.85)' }}>{day.day} {currentDay === day.day && '(Idag)'}</Typography>
        {isLoggedIn && (
          <IconButton size="small" onClick={() => handleAddTimeSlot(day.id)} color="primary">
            <Plus size={18} />
          </IconButton>
        )}
      </Box>
      
      <Box sx={{ p: 2 }}>
        {day.times.length === 0 ? (
          <Typography sx={{ textAlign: 'center', py: 2, color: 'text.secondary' }}>Inga tider schemalagda</Typography>
        ) : (
          day.times.map((time) => {
            const isCurrentTimeSlot = currentDay === day.day && currentTimeMinutes >= timeToMinutes(time.start) && currentTimeMinutes < timeToMinutes(time.end);
            const isNextTimeSlot = nextOpening.day === day.day && nextOpening.time === time.start;
            return (
              <Box key={time.id} sx={{ bgcolor: isCurrentTimeSlot ? 'rgba(0, 255, 8, 0.5)' : isNextTimeSlot ? 'rgba(168, 151, 214, 0.95)' : 'rgba(255,255,255,0.75)', p: 1, mb: 1, borderRadius: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: (isCurrentTimeSlot || isNextTimeSlot) ? '1px solid' : 'none', borderColor: isCurrentTimeSlot ? 'success.main' : 'primary.main' }}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <Typography variant="body1" sx={{ fontWeight: isCurrentTimeSlot || isNextTimeSlot ? '600' : '400' }}>{time.start} - {time.end}{isCurrentTimeSlot && ' (Nu)'}{isNextTimeSlot && ' (Nästa)'}</Typography>
                </Box>
                {isLoggedIn && (
                  <Box sx={{ display: 'flex' }}>
                    <IconButton size="small" onClick={() => handleEditTimeSlot(day.id, time)} color="primary"><Edit size={16} /></IconButton>
                    <IconButton size="small" onClick={() => handleDeleteTimeSlot(day.id, time.id)} color="error"><Trash2 size={16} /></IconButton>
                  </Box>
                )}
              </Box>
            );
          })
        )}
      </Box>
    </Paper>
  );
};