import React, { useState, useEffect } from 'react';
import {
  Box, CssBaseline, Paper, BottomNavigation, BottomNavigationAction,
  ThemeProvider, AppBar, Toolbar, Typography, Button,
  Snackbar, IconButton, CircularProgress, Backdrop,
  Switch, FormControlLabel, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField
} from '@mui/material';
import { LogIn, LogOut, Calendar, Circle, X } from 'lucide-react';
import { theme } from './theme';
import { User, DaySchedule, TimeSlot, NextOpening } from './types';
import {
  timeToMinutes, getDayOfWeekSwedish,
  getCurrentTimeInMinutes, getCurrentDayIndex
} from './utils';
import LoginDialog from './components/LoginScreen';
import TimeSlotEditDialog from './components/TimeSlotEditDialog';
import StatusScreen from './components/StatusScreen';
import ScheduleScreen from './components/ScheduleScreen';
import MulberrySymbols from './components/MulberrySymbolPicker';
import {
  getSchedule, addTimeSlot as addTimeSlotToDb,
  updateTimeSlot as updateTimeSlotInDb,
  deleteTimeSlot as deleteTimeSlotFromDb,
  signIn, signOut, getOverrideStatus, updateOverrideStatus,
  getSymbolMessages, saveSymbolMessage,
  getSymbolUrl, uploadSymbol
} from './services/appwriteService';

// Define Symbol interface
interface Symbol {
  id: string;
  name: string;
  image_url: string;
  svg?: string;
}

const App: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(0);
  const [currentTime, setCurrentTime] = useState('');
  const [currentDay, setCurrentDay] = useState('');
  const [nextOpening, setNextOpening] = useState<NextOpening>({ day: '', time: '', minutesUntil: 0 });
  const [currentTimeMinutes, setCurrentTimeMinutes] = useState(0);

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loginDialogOpen, setLoginDialogOpen] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  // Override state
  const [manualOverride, setManualOverride] = useState(false);
  const [overrideMessage, setOverrideMessage] = useState('');
  const [messageDialogOpen, setMessageDialogOpen] = useState(false);
  
  // Away mode symbol picker state
  const [awaySymbolPickerOpen, setAwaySymbolPickerOpen] = useState(false);
  const [awaySymbol, setAwaySymbol] = useState<Symbol | null>(null);

  // Symbol message states
  const [openSymbolMessage, setOpenSymbolMessage] = useState('Vi har öppet');
  const [closedSymbolMessage, setClosedSymbolMessage] = useState('Vi har stängt');
  const [awaySymbolMessage, setAwaySymbolMessage] = useState('Borta för tillfället');

  // Symbol states - moved to App level to share between components
  const [openSymbol, setOpenSymbol] = useState<Symbol | null>(null);
  const [closedSymbol, setClosedSymbol] = useState<Symbol | null>(null);

  const [scheduleData, setScheduleData] = useState<DaySchedule[]>([]);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');

  const [selectedDayId, setSelectedDayId] = useState<string>('');
  const [editingTimeSlot, setEditingTimeSlot] = useState<{ dayId: string, timeSlot: TimeSlot | null }>({ dayId: '', timeSlot: null });
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');

  // Load schedule, override status, symbols, and symbol messages once on mount
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        const schedule = await getSchedule();
        setScheduleData(schedule);
        
        // Get initial override status
        const overrideStatus = await getOverrideStatus();
        setManualOverride(overrideStatus.manualOverride);
        setOverrideMessage(overrideStatus.message);

        // Load symbol messages
        const messages = await getSymbolMessages();
        if (messages) {
          setOpenSymbolMessage(messages.openMessage || 'Vi har öppet');
          setClosedSymbolMessage(messages.closedMessage || 'Vi har stängt');
          if (messages.awayMessage) {
            setAwaySymbolMessage(messages.awayMessage);
          }
        }

        // Load symbols
        loadSymbols();
      } catch (error) {
        console.error('Error loading data:', error);
        showSnackbar('Error loading data');
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  // Function to load symbols
  const loadSymbols = async () => {
    try {
      // Load open symbol
      const openUrl = getSymbolUrl('open');
      if (openUrl) {
        setOpenSymbol({
          id: 'open',
          name: 'Open Symbol',
          image_url: openUrl + '&timestamp=' + Date.now()
        });
      }

      // Load closed symbol
      const closedUrl = getSymbolUrl('closed');
      if (closedUrl) {
        setClosedSymbol({
          id: 'closed',
          name: 'Closed Symbol',
          image_url: closedUrl + '&timestamp=' + Date.now()
        });
      }
      
      // Load away symbol
      try {
        const awayUrl = getSymbolUrl('away');
        if (awayUrl) {
          setAwaySymbol({
            id: 'away',
            name: 'Away Symbol',
            image_url: awayUrl + '&timestamp=' + Date.now()
          });
        }
      } catch (err) {
        console.log('Away symbol not found, will be created when needed');
      }
    } catch (err) {
      console.error('Error loading saved symbols:', err);
    }
  };

  // Update time every minute
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const hours = now.getHours().toString().padStart(2, '0');
      const minutes = now.getMinutes().toString().padStart(2, '0');
      setCurrentTime(`${hours}:${minutes}`);
      setCurrentDay(getDayOfWeekSwedish(now));
      setCurrentTimeMinutes(now.getHours() * 60 + now.getMinutes());
    };

    updateTime();
    const interval = setInterval(updateTime, 60000);
    return () => clearInterval(interval);
  }, []);

  // Update next opening when time or schedule changes
  useEffect(() => {
    if (scheduleData.length > 0) {
      const next = findNextOpening(scheduleData);
      setNextOpening(next);
    }
  }, [scheduleData, currentTime]);

  // Function to handle symbol update from ScheduleScreen
  const handleSymbolUpdate = (type: 'open' | 'closed', symbol: Symbol) => {
    if (type === 'open') {
      setOpenSymbol(symbol);
    } else {
      setClosedSymbol(symbol);
    }
  };

  // Handle symbol message updates
  const handleUpdateSymbolMessages = async (openMessage: string, closedMessage: string): Promise<void> => {
    setIsLoading(true);
    try {
      // Update open message
      const openSuccess = await saveSymbolMessage('open', openMessage);
      
      // Update closed message
      const closedSuccess = await saveSymbolMessage('closed', closedMessage);
      
      if (openSuccess && closedSuccess) {
        setOpenSymbolMessage(openMessage);
        setClosedSymbolMessage(closedMessage);
        showSnackbar('Symbolmeddelanden uppdaterade');
      } else {
        showSnackbar('Kunde inte uppdatera symbolmeddelanden');
      }
    } catch (error) {
      console.error('Error updating symbol messages:', error);
      showSnackbar('Ett fel uppstod vid uppdatering av symbolmeddelanden');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle override switch toggle - Modified for away mode
  const handleOverrideToggle = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const newOverrideState = event.target.checked;
    
    // If turning on override
    if (newOverrideState) {
      setManualOverride(newOverrideState);
      
      // Always show symbol picker first when turning on away mode
      setAwaySymbolPickerOpen(true);
    } else {
      // If turning off, update with empty message
      setIsLoading(true);
      try {
        const success = await updateOverrideStatus(newOverrideState, '');
        if (success) {
          setManualOverride(newOverrideState);
          setOverrideMessage('');
          showSnackbar('Bortaläge avstängt');
        } else {
          showSnackbar('Kunde inte stänga av bortaläge');
        }
      } catch (error) {
        console.error('Error updating override:', error);
        showSnackbar('Ett fel uppstod vid avstängning av bortaläge');
      } finally {
        setIsLoading(false);
      }
    }
  };

  // Handle saving override message
  const handleSaveMessage = async () => {
    setIsLoading(true);
    try {
      // First save the override message to Appwrite
      const success = await updateOverrideStatus(manualOverride, overrideMessage);
      
      // Then save it as the away symbol message
      if (success && overrideMessage) {
        await saveSymbolMessage('away', overrideMessage);
        setAwaySymbolMessage(overrideMessage);
      }
      
      if (success) {
        setMessageDialogOpen(false);
        showSnackbar('Bortaläges-meddelande sparat');
      } else {
        showSnackbar('Kunde inte spara bortaläges-meddelande');
      }
    } catch (error) {
      console.error('Error saving override message:', error);
      showSnackbar('Ett fel uppstod vid sparande av bortaläges-meddelande');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle message dialog close without saving
  const handleCancelMessage = () => {
    // If canceling when first turning on, revert the switch
    if (manualOverride && overrideMessage === '') {
      setManualOverride(false);
    }
    setMessageDialogOpen(false);
  };

  // Handle away symbol picker close
  const handleAwaySymbolPickerClose = () => {
    // If closing without selecting a symbol, revert the switch
    if (manualOverride && !awaySymbol) {
      setManualOverride(false);
    }
    setAwaySymbolPickerOpen(false);
  };

  // Handle away symbol selection
  const handleAwaySymbolCompleted = (data: { svgString: string; id?: string; message: string; url: string }) => {
    // Create a symbol object
    const symbol: Symbol = {
      id: 'away',
      name: 'Away Symbol',
      image_url: data.url + '&timestamp=' + Date.now(),
      svg: data.svgString
    };
    
    // Update away symbol state
    setAwaySymbol(symbol);
    
    // If a message was provided with the symbol, use it
    if (data.message) {
      setOverrideMessage(data.message);
      setAwaySymbolMessage(data.message);
    }
    
    // Close symbol picker and open message dialog
    setAwaySymbolPickerOpen(false);
    setMessageDialogOpen(true);
  };

  const findNextOpening = (scheduleData: DaySchedule[]): NextOpening => {
    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
  
    for (let offset = 0; offset < 7; offset++) {
      const dayDate = new Date(now);
      dayDate.setDate(now.getDate() + offset);
      const dayIndex = dayDate.getDay(); // 0 (Sun) to 6 (Sat)
  
      const daySchedule = scheduleData[dayIndex];
      if (!daySchedule) continue;
  
      const futureSlot = daySchedule.times.find(slot => {
        const startMinutes = timeToMinutes(slot.start);
        return offset > 0 || startMinutes > nowMinutes;
      });
  
      if (futureSlot) {
        const startMinutes = timeToMinutes(futureSlot.start);
        const minutesUntil = offset * 24 * 60 + (startMinutes - nowMinutes);
        return {
          day: getDayOfWeekSwedish(dayDate),
          time: futureSlot.start,
          minutesUntil
        };
      }
    }
  
    // Fallback (no opening found)
    return { day: '', time: '', minutesUntil: 0 };
  };
  
  const handleLoginOpen = () => {
    setLoginDialogOpen(true);
    setLoginError('');
  };

  const handleLogin = async () => {
    setIsLoading(true);
    try {
      const user = await signIn(username, password);
      if (user) {
        setCurrentUser(user);
        setIsLoggedIn(true);
        setLoginDialogOpen(false);
        setUsername('');
        setPassword('');
        setLoginError('');
        showSnackbar(`Välkommen ${user.name}!`);
      } else {
        setLoginError('Fel användarnamn eller lösenord');
      }
    } catch (error) {
      console.error('Login error:', error);
      setLoginError('Ett fel uppstod vid inloggning');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    setIsLoading(true);
    try {
      await signOut();
      setIsLoggedIn(false);
      setCurrentUser(null);
      setActiveTab(0);
      showSnackbar('Du har loggat ut');
    } catch (error) {
      console.error('Logout error:', error);
      showSnackbar('Ett fel uppstod vid utloggning');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddTimeSlot = (dayId: string) => {
    setSelectedDayId(dayId);
    setEditingTimeSlot({ dayId, timeSlot: null });
    setStartTime('09:00');
    setEndTime('10:00');
    setEditDialogOpen(true);
  };

  const handleEditTimeSlot = (dayId: string, timeSlot: TimeSlot) => {
    setSelectedDayId(dayId);
    setEditingTimeSlot({ dayId, timeSlot });
    setStartTime(timeSlot.start);
    setEndTime(timeSlot.end);
    setEditDialogOpen(true);
  };

  const handleDeleteTimeSlot = async (dayId: string, timeSlotId: string) => {
    setIsLoading(true);
    try {
      const success = await deleteTimeSlotFromDb(timeSlotId);
      if (success) {
        const updated = scheduleData.map(day =>
          day.id === dayId
            ? { ...day, times: day.times.filter(time => time.id !== timeSlotId) }
            : day
        );
        setScheduleData(updated);
        showSnackbar('Tidslucka raderad');
      } else {
        showSnackbar('Kunde inte radera tidsluckan');
      }
    } catch (error) {
      console.error('Error deleting time slot:', error);
      showSnackbar('Ett fel uppstod');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveTimeSlot = async () => {
    if (!startTime || !endTime) return showSnackbar('Både start- och sluttid måste anges');
    if (timeToMinutes(startTime) >= timeToMinutes(endTime)) return showSnackbar('Starttid måste vara före sluttid');
    setIsLoading(true);
    try {
      if (editingTimeSlot.timeSlot) {
        const success = await updateTimeSlotInDb(editingTimeSlot.timeSlot.id, { start: startTime, end: endTime });
        if (success) {
          const updated = scheduleData.map(day =>
            day.id === selectedDayId
              ? {
                  ...day,
                  times: day.times.map(time =>
                    time.id === editingTimeSlot.timeSlot!.id ? { ...time, start: startTime, end: endTime } : time
                  ),
                }
              : day
          );
          setScheduleData(updated);
          setEditDialogOpen(false);
          showSnackbar('Tidslucka uppdaterad');
        } else {
          showSnackbar('Kunde inte uppdatera tidsluckan');
        }
      } else {
        const newTimeSlot = await addTimeSlotToDb(selectedDayId, { start: startTime, end: endTime });
        if (newTimeSlot) {
          const updated = scheduleData.map(day =>
            day.id === selectedDayId ? { ...day, times: [...day.times, newTimeSlot] } : day
          );
          setScheduleData(updated);
          setEditDialogOpen(false);
          showSnackbar('Ny tidslucka tillagd');
        } else {
          showSnackbar('Kunde inte lägga till tidsluckan');
        }
      }
    } catch (error) {
      console.error('Error saving time slot:', error);
      showSnackbar('Ett fel uppstod');
    } finally {
      setIsLoading(false);
    }
  };

  const showSnackbar = (message: string) => {
    setSnackbarMessage(message);
    setSnackbarOpen(true);
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ pb: 7, minHeight: '100vh' }}>
        <AppBar position="static">
          <Toolbar>
            <Typography variant="h6" sx={{ flexGrow: 1 }}>Öppettider</Typography>
            
            {isLoggedIn && (
              <FormControlLabel
                control={
                  <Switch 
                    checked={manualOverride}
                    onChange={handleOverrideToggle}
                    color="warning" // Orange color for away mode
                  />
                }
                label="Borta-läge"
                sx={{ mr: 2, color: 'white' }}
              />
            )}
            
            {isLoggedIn ? (
              <Button color="inherit" onClick={handleLogout} startIcon={<LogOut size={18} />}>
                Logga ut ({currentUser?.name})
              </Button>
            ) : (
              <Button color="inherit" onClick={handleLoginOpen} startIcon={<LogIn size={18} />}>
                Logga in
              </Button>
            )}
          </Toolbar>
        </AppBar>

        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 'calc(100vh - 120px)' }}>
            <CircularProgress />
          </Box>
        ) : (
          activeTab === 0 ? (
            <StatusScreen
              currentDay={currentDay}
              currentTime={currentTime}
              currentTimeMinutes={currentTimeMinutes}
              nextOpening={nextOpening}
              scheduleData={scheduleData}
              openSymbol={openSymbol}
              closedSymbol={closedSymbol}
              awaySymbol={awaySymbol}
              openSymbolMessage={openSymbolMessage}
              closedSymbolMessage={closedSymbolMessage}
              awaySymbolMessage={awaySymbolMessage}
              manualOverride={manualOverride}
              overrideMessage={overrideMessage}
            />
          ) : (
            <ScheduleScreen
              currentDay={currentDay}
              currentTime={currentTime}
              currentTimeMinutes={currentTimeMinutes}
              nextOpening={nextOpening}
              scheduleData={scheduleData}
              isLoggedIn={isLoggedIn}
              isAdmin={isLoggedIn}
              currentUser={currentUser}
              handleAddTimeSlot={handleAddTimeSlot}
              handleEditTimeSlot={handleEditTimeSlot}
              handleDeleteTimeSlot={handleDeleteTimeSlot}
              openSymbolMessage={openSymbolMessage}
              closedSymbolMessage={closedSymbolMessage}
              onSymbolUpdate={handleSymbolUpdate}
            />
          )
        )}

        <Paper sx={{ position: 'fixed', bottom: 0, left: 0, right: 0 }} elevation={3}>
          <BottomNavigation
            showLabels
            value={activeTab}
            onChange={(event, newValue) => setActiveTab(newValue)}
          >
            <BottomNavigationAction label="Just nu" icon={<Circle size={24} />} />
            <BottomNavigationAction label="Schema" icon={<Calendar size={24} />} />
          </BottomNavigation>
        </Paper>

        {/* Login Dialog */}
        <LoginDialog
          open={loginDialogOpen}
          onClose={() => setLoginDialogOpen(false)}
          username={username}
          password={password}
          error={loginError}
          onUsernameChange={(e) => setUsername(e.target.value)}
          onPasswordChange={(e) => setPassword(e.target.value)}
          onLogin={handleLogin}
        />

        {/* Time Slot Edit Dialog */}
        <TimeSlotEditDialog
          open={editDialogOpen}
          onClose={() => setEditDialogOpen(false)}
          startTime={startTime}
          endTime={endTime}
          onStartTimeChange={(e) => setStartTime(e.target.value)}
          onEndTimeChange={(e) => setEndTime(e.target.value)}
          onSave={handleSaveTimeSlot}
          isEditing={!!editingTimeSlot.timeSlot}
        />

        {/* Away Symbol Picker Dialog */}
        <Dialog
          open={awaySymbolPickerOpen}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>Välj symbol för bortaläge</DialogTitle>
          <DialogContent>
            <MulberrySymbols
              sourceUrl="/symbols/icons.html"
              symbolType="away"
              onCompleted={handleAwaySymbolCompleted}
              onClose={handleAwaySymbolPickerClose}
            />
          </DialogContent>
        </Dialog>

        {/* Override Message Dialog */}
        <Dialog open={messageDialogOpen} onClose={handleCancelMessage}>
          <DialogTitle>Sätt meddelande för bortaläge</DialogTitle>
          <DialogContent>
            <TextField
              autoFocus
              margin="dense"
              label="Meddelande"
              fullWidth
              variant="outlined"
              value={overrideMessage}
              onChange={(e) => setOverrideMessage(e.target.value)}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCancelMessage}>Avbryt</Button>
            <Button onClick={handleSaveMessage}>Spara</Button>
          </DialogActions>
        </Dialog>

        <Backdrop sx={{ color: '#fff', zIndex: theme => theme.zIndex.drawer + 1 }} open={isLoading}>
          <CircularProgress color="inherit" />
        </Backdrop>

        <Snackbar
          open={snackbarOpen}
          autoHideDuration={4000}
          onClose={() => setSnackbarOpen(false)}
          message={snackbarMessage}
          action={
            <IconButton size="small" color="inherit" onClick={() => setSnackbarOpen(false)}>
              <X size={16} />
            </IconButton>
          }
        />
      </Box>
    </ThemeProvider>
  );
};

export default App;