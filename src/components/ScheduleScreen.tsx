import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Container,
  Typography,
  Paper,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  Snackbar,
  Alert,
  CircularProgress,
  Divider
} from '@mui/material';
import {
  Plus,
  Edit,
  Trash2,
  User as UserIcon,
  Image as ImageIcon
} from 'lucide-react';
import Clock from 'react-clock';
import 'react-clock/dist/Clock.css'; // Import the styles

import { DaySchedule, TimeSlot, User, NextOpening } from '../types';
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
  currentTime?: string;
  currentTimeMinutes?: number;
  nextOpening: NextOpening;
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
  manualoverride?: boolean;
};

// Map short day names to full Swedish day names
const fullDayNames: Record<string, string> = {
  'Mån': 'Måndag',
  'Tis': 'Tisdag',
  'Ons': 'Onsdag',
  'Tors': 'Torsdag',
  'Fre': 'Fredag',
  'Lör': 'Lördag',
  'Sön': 'Söndag'
};

// Helper to get current date in Swedish format
const getCurrentDateString = (): string => {
  const now = new Date();
  
  // Get day of month
  const day = now.getDate();
  
  // Get month name in Swedish
  const monthNames = ['januari', 'februari', 'mars', 'april', 'maj', 'juni', 
                      'juli', 'augusti', 'september', 'oktober', 'november', 'december'];
  const month = monthNames[now.getMonth()];
  
  // Get year
  const year = now.getFullYear();
  
  // Format as "2 maj 2025"
  return `${day} ${month} ${year}`;
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

  // Create a separate state for the clock that updates every second
  const [clockTime, setClockTime] = useState(new Date());
  
  // State for business hours
  const [now, setNow] = useState(new Date());
  const displayTime = currentTime || now.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
  const timeInMinutes = currentTimeMinutes || (now.getHours() * 60 + now.getMinutes());
  
  // Get the current full date string
  const currentDateString = useMemo(() => getCurrentDateString(), []);
  
  // Get full day name
  const fullDayName = useMemo(() => fullDayNames[currentDay] || currentDay, [currentDay]);
  
  // Current day schedule and color
  const currentDaySchedule = useMemo(() => {
    return scheduleData.find(day => day.day === currentDay);
  }, [scheduleData, currentDay]);
  
  // Find day color but use a lighter version
  const dayColor = useMemo(() => {
    // Find the day in schedule data
    const daySchedule = scheduleData.find(day => day.day === currentDay);
    if (daySchedule && daySchedule.color) {
      // Use a lighter version by applying opacity via rgba
      // This assumes the color is in a format we can extract values from
      if (daySchedule.color.startsWith('#')) {
        // Add some transparency to the hex color
        return daySchedule.color + '88'; // 88 is approx 50% opacity in hex
      } else if (daySchedule.color.startsWith('rgb')) {
        // Convert rgb to rgba with opacity
        return daySchedule.color.replace('rgb', 'rgba').replace(')', ', 0.5)');
      }
      return daySchedule.color;
    }
    return 'rgba(25, 118, 210, 0.5)'; // Fallback to a light blue
  }, [currentDay, scheduleData]);
  
  // Clock-specific useEffect that updates every second for smooth animation
  useEffect(() => {
    // Update the clock time every second
    const clockInterval = setInterval(() => {
      setClockTime(new Date());
    }, 1000);
    
    // Clean up the interval
    return () => clearInterval(clockInterval);
  }, []);
  
  // Business logic update (slower frequency)
  useEffect(() => {
    if (!currentTime) {
      // This updates the business logic time (minutes-based)
      // This can run at a lower frequency since it's just for calculations
      const timeInterval = setInterval(() => {
        const newNow = new Date();
        setNow(newNow);
      }, 60000); // Update business logic every minute
      
      return () => clearInterval(timeInterval);
    }
  }, [currentTime]);

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
    <Container maxWidth="md" sx={{ mt: 4, mb: 8 }}>
      {/* Day and Clock Header */}
      <Box sx={{ textAlign: 'center', mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 4, mb: 3 }}>
          {/* Day widget */}
          <Paper 
            elevation={2} 
            sx={{ 
              px: 3, 
              py: 1.5, 
              borderRadius: 2,
              bgcolor: dayColor,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: 150
            }}
          >
            <Typography 
              variant="h4" 
              sx={{ 
                fontWeight: 'bold', 
                color: 'rgba(0,0,0,0.85)',
                mb: 0.5
              }}
            >
              {fullDayName}
            </Typography>
            <Typography 
              variant="h6" 
              sx={{ color: 'rgba(0,0,0,0.7)' }}
            >
              {currentDateString}
            </Typography>
          </Paper>
          
          {/* Real-time clock component */}
          <Box sx={{ 
            p: 2, 
            borderRadius: '50%', 
            bgcolor: 'background.paper',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: 3,
            width: 160,
            height: 160
          }}>
            <Clock 
              value={clockTime} // Use clockTime that updates every second
              size={140}
              renderNumbers={true}
              hourHandLength={50}
              hourHandWidth={4}
              minuteHandLength={70}
              minuteHandWidth={2}
              secondHandLength={75}
              secondHandWidth={1}
            />
          </Box>
        </Box>
      </Box>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Schema
        </Typography>
        
      </Box>

      <Box sx={{ display: { xs: 'block', md: 'none' } }}>
        {sortedScheduleData.map((day) => (
          <DayCard
            key={day.id}
            {...{ day, currentDay, timeInMinutes, nextOpening, isLoggedIn, handleAddTimeSlot, handleEditTimeSlot, handleDeleteTimeSlot, openSymbol, closedSymbol }}
          />
        ))}
      </Box>

      <Box sx={{ display: { xs: 'none', md: 'flex' }, gap: 2, flexWrap: 'wrap', justifyContent: 'center' }}>
        {sortedScheduleData.map((day) => (
          <Box key={day.id} sx={{ width: 'calc(25% - 16px)', minWidth: '150px' }}>
            <DayCard
              {...{ day, currentDay, timeInMinutes, nextOpening, isLoggedIn, handleAddTimeSlot, handleEditTimeSlot, handleDeleteTimeSlot, openSymbol, closedSymbol }}
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
  timeInMinutes,
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
  timeInMinutes: number;
  nextOpening: NextOpening;
  isLoggedIn: boolean;
  handleAddTimeSlot: (dayId: string) => void;
  handleEditTimeSlot: (dayId: string, timeSlot: TimeSlot) => void;
  handleDeleteTimeSlot: (dayId: string, timeSlotId: string) => void;
  openSymbol: Symbol | null;
  closedSymbol: Symbol | null;
}) => {
  const hasCurrentTimeSlot = day.times.some(time => currentDay === day.day && timeInMinutes >= timeToMinutes(time.start) && timeInMinutes < timeToMinutes(time.end));

  // Determine which symbol to show based on whether the place is currently open
  const symbolToShow = hasCurrentTimeSlot ? openSymbol : closedSymbol;
  
  // Function to convert time string to Date object for the clock
  const timeStringToDate = (timeStr: string) => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    const date = new Date();
    date.setHours(hours);
    date.setMinutes(minutes);
    date.setSeconds(0);
    return date;
  };

  return (
    <Paper elevation={currentDay === day.day ? 5 : 2} sx={{ bgcolor: day.color, mb: 2, overflow: 'hidden', border: currentDay === day.day ? '2px solid #1976d2' : 'none' }}>
      <Box sx={{ py: 1, bgcolor: 'rgba(0,0,0,0.15)', textAlign: 'center', display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 'bold', color: 'rgba(0,0,0,0.85)' }}>{day.day} {currentDay === day.day && '(Idag)'}</Typography>
        {isLoggedIn && (
          <IconButton size="small" onClick={() => handleAddTimeSlot(day.id)} color="primary">
            <Plus size={24} />
          </IconButton>
        )}
      </Box>
      
      <Box sx={{ p: 2 }}>
        {day.times.length === 0 ? (
          <Typography sx={{ textAlign: 'center', py: 2, color: 'text.secondary' }}>Inga tider schemalagda</Typography>
        ) : (
          day.times.map((time) => {
            const isCurrentTimeSlot = currentDay === day.day && timeInMinutes >= timeToMinutes(time.start) && timeInMinutes < timeToMinutes(time.end);
            const isNextTimeSlot = nextOpening.day === day.day && nextOpening.time === time.start;
            
            // Create Date objects for start and end times
            const startTime = timeStringToDate(time.start);
            const endTime = timeStringToDate(time.end);
            
            return (
              <Box key={time.id} sx={{ 
                bgcolor: isCurrentTimeSlot ? 'rgba(0, 255, 8, 0.5)' : isNextTimeSlot ? 'rgba(168, 151, 214, 0.95)' : 'rgba(255,255,255,0.75)', 
                p: 1, 
                mb: 1, 
                borderRadius: 1, 
                display: 'flex', 
                flexDirection: 'column',
                border: (isCurrentTimeSlot || isNextTimeSlot) ? '1px solid' : 'none', 
                borderColor: isCurrentTimeSlot ? 'success.main' : 'primary.main' 
              }}>
                {/* Top row with time text and buttons */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Typography variant="body1" sx={{ fontWeight: isCurrentTimeSlot || isNextTimeSlot ? '600' : '400' }}>
                      {time.start} - {time.end}{isCurrentTimeSlot && ' (Nu)'}{isNextTimeSlot && ' (Nästa)'}
                    </Typography>
                  </Box>
                  
                  {isLoggedIn && (
                    <Box sx={{ display: 'flex' }}>
                      <IconButton size="small" onClick={() => handleEditTimeSlot(day.id, time)} color="primary">
                        <Edit size={24} />
                      </IconButton>
                      <IconButton size="small" onClick={() => handleDeleteTimeSlot(day.id, time.id)} color="error">
                        <Trash2 size={24} />
                      </IconButton>
                    </Box>
                  )}
                </Box>
                
                {/* Bottom row with clocks */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mx: 2 }}>
                  {/* Start time clock */}
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <Typography variant="caption" sx={{ mb: 0.5 }}>Start</Typography>
                    <Clock 
                      value={startTime}
                      size={55}
                      renderNumbers={false}
                      hourHandLength={40}
                      hourHandWidth={2}
                      minuteHandLength={60}
                      minuteHandWidth={1}
                      renderSecondHand={false}
                      
                    />
                  </Box>
                  
                  {/* End time clock */}
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <Typography variant="caption" sx={{ mb: 0.5 }}>Slut</Typography>
                    <Clock 
                      value={endTime}
                      size={55}
                      renderNumbers={false}
                      hourHandLength={40}
                      hourHandWidth={2}
                      minuteHandLength={60}
                      minuteHandWidth={1}
                      renderSecondHand={false}
                    />
                  </Box>
                </Box>
              </Box>
            );
          })
        )}
      </Box>
    </Paper>
  );
};