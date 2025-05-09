import React, { useState, useEffect } from 'react';
import {
  Box, CssBaseline, Paper, BottomNavigation, BottomNavigationAction,
  ThemeProvider, AppBar, Toolbar, Typography, Button,
  Snackbar, IconButton, CircularProgress, Backdrop,
  Switch, FormControlLabel, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField
} from '@mui/material';
import { LogIn, LogOut, Calendar, Circle, X, Gavel } from 'lucide-react';
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
import MeetingsScreen from './components/MeetingsScreen';
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
        // Always load override status first, before checking schedule
        const overrideStatus = await getOverrideStatus();
        console.log('Loaded override status:', overrideStatus); // Debug log
        
        // Set these values from what's stored in Appwrite
        setManualOverride(overrideStatus.manualOverride === true);
        setOverrideMessage(overrideStatus.message || '');
        
        // Then load schedule
        const schedule = await getSchedule();
        setScheduleData(schedule);

        // Load symbol messages
        const messages = await getSymbolMessages();
        if (messages) {
          setOpenSymbolMessage(messages.openMessage || 'Vi har öppet');
          setClosedSymbolMessage(messages.closedMessage || 'Vi har stängt');
          if (messages.awayMessage) {
            setAwaySymbolMessage(messages.awayMessage);
            // If override is active but no override message, use the away message
            if (overrideStatus.manualOverride && !overrideStatus.message) {
              setOverrideMessage(messages.awayMessage);
            }
          }
        }

        // Load symbols
        await loadSymbols();
        
        // Display debug status
        if (overrideStatus.manualOverride) {
          console.log('Away mode is active with message:', overrideStatus.message);
        } else {
          console.log('Away mode is not active');
        }
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
      try {
        const openUrl = getSymbolUrl('open');
        if (openUrl) {
          setOpenSymbol({
            id: 'open',
            name: 'Open Symbol',
            image_url: openUrl + '&timestamp=' + Date.now()
          });
          console.log('Loaded open symbol');
        }
      } catch (err) {
        console.error('Error loading open symbol:', err);
      }

      // Load closed symbol
      try {
        const closedUrl = getSymbolUrl('closed');
        if (closedUrl) {
          setClosedSymbol({
            id: 'closed',
            name: 'Closed Symbol',
            image_url: closedUrl + '&timestamp=' + Date.now()
          });
          console.log('Loaded closed symbol');
        }
      } catch (err) {
        console.error('Error loading closed symbol:', err);
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
          console.log('Loaded away symbol');
        }
      } catch (err) {
        console.log('Away symbol not found, will be created when needed:', err);
      }
    } catch (err) {
      console.error('Error loading saved symbols:', err);
    }
  };

  // Update time every minute and also check away mode status
  useEffect(() => {
    const updateTime = async () => {
      const now = new Date();
      const hours = now.getHours().toString().padStart(2, '0');
      const minutes = now.getMinutes().toString().padStart(2, '0');
      setCurrentTime(`${hours}:${minutes}`);
      setCurrentDay(getDayOfWeekSwedish(now));
      setCurrentTimeMinutes(now.getHours() * 60 + now.getMinutes());
      
      // Check away mode status on each minute update
      try {
        // Check override status first
        const overrideStatus = await getOverrideStatus();
        setManualOverride(overrideStatus.manualOverride === true);
        if (overrideStatus.manualOverride) {
          setOverrideMessage(overrideStatus.message || '');
          console.log('Away mode check: active with message:', overrideStatus.message);
        } else {
          console.log('Away mode check: not active');
        }
        
        // Reload symbol messages
        const messages = await getSymbolMessages();
        if (messages) {
          setOpenSymbolMessage(messages.openMessage || 'Vi har öppet');
          setClosedSymbolMessage(messages.closedMessage || 'Vi har stängt');
          if (messages.awayMessage) {
            setAwaySymbolMessage(messages.awayMessage);
            // If override is active but no override message, use the away message
            if (overrideStatus.manualOverride && !overrideStatus.message) {
              setOverrideMessage(messages.awayMessage);
            }
          }
        }
        
        // Reload symbols with timestamp to prevent caching
        try {
          // Reload open symbol
          const openUrl = getSymbolUrl('open');
          if (openUrl) {
            setOpenSymbol({
              id: 'open',
              name: 'Open Symbol',
              image_url: openUrl + '&timestamp=' + Date.now()
            });
          }
          
          // Reload closed symbol
          const closedUrl = getSymbolUrl('closed');
          if (closedUrl) {
            setClosedSymbol({
              id: 'closed',
              name: 'Closed Symbol',
              image_url: closedUrl + '&timestamp=' + Date.now()
            });
          }
          
          // Reload away symbol
          const awayUrl = getSymbolUrl('away');
          if (awayUrl) {
            setAwaySymbol({
              id: 'away',
              name: 'Away Symbol',
              image_url: awayUrl + '&timestamp=' + Date.now()
            });
          }
        } catch (err) {
          console.error('Error reloading symbols:', err);
        }
        
      } catch (error) {
        console.error('Error checking override status:', error);
      }
    };

    updateTime();
    const interval = setInterval(updateTime, 60000);
    return () => clearInterval(interval);
  }, []);

  // Update next opening when time or schedule changes
  // Modified to check away mode first before calculating next opening
  useEffect(() => {
    if (scheduleData.length > 0) {
      // Always calculate next opening time, regardless of away mode
      // This way we can show when we would normally open next even in away mode
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

  // Handle override switch toggle - Modified for away mode with better persistence
  const handleOverrideToggle = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const newOverrideState = event.target.checked;
    
    // If turning on override
    if (newOverrideState) {
      // Set state before showing dialog
      setManualOverride(true);
      
      // Save the override state immediately (with empty message if no previous one)
      // This ensures the override state persists even if user refreshes before choosing symbol
      try {
        console.log('Saving initial override state...');
        await updateOverrideStatus(true, overrideMessage || 'Borta för tillfället');
      } catch (error) {
        console.error('Error updating initial override state:', error);
      }
      
      // Always show symbol picker when turning on away mode
      setAwaySymbolPickerOpen(true);
    } else {
      // If turning off, update with empty message
      setIsLoading(true);
      try {
        console.log('Turning off away mode...');
        const success = await updateOverrideStatus(false, '');
        if (success) {
          setManualOverride(false);
          setOverrideMessage('');
          showSnackbar('Bortaläge avstängt');
        } else {
          // If the save failed, revert the toggle UI
          event.preventDefault();
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
      console.log('Saving override message:', overrideMessage);
      
      // First save the override message to Appwrite
      const success = await updateOverrideStatus(true, overrideMessage);
      
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
      // Also update the database to turn off override
      updateOverrideStatus(false, '').catch(err => {
        console.error('Error turning off override after cancel:', err);
      });
    }
    setMessageDialogOpen(false);
  };

  // Handle away symbol picker close
  const handleAwaySymbolPickerClose = () => {
    // If closing without selecting a symbol, revert the switch
    if (manualOverride && !awaySymbol) {
      setManualOverride(false);
      // Also update the database to turn off override
      updateOverrideStatus(false, '').catch(err => {
        console.error('Error turning off override after symbol picker close:', err);
      });
    }
    setAwaySymbolPickerOpen(false);
  };

  // Handle away symbol selection with better persistence
  const handleAwaySymbolCompleted = async (data: { svgString: string; id?: string; message: string; url: string }) => {
    setIsLoading(true);
    try {
      console.log('Selected away symbol:', data);
      
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
        
        // Save the override status immediately to ensure persistence
        await updateOverrideStatus(true, data.message);
        
        // Also save as the away symbol message
        await saveSymbolMessage('away', data.message);
      }
      
      // Close symbol picker and open message dialog
      setAwaySymbolPickerOpen(false);
      
      // Only show message dialog if we need to set a message
      if (!data.message) {
        setMessageDialogOpen(true);
      } else {
        showSnackbar('Bortaläge aktiverat med vald symbol och meddelande');
      }
    } catch (error) {
      console.error('Error handling away symbol selection:', error);
      showSnackbar('Ett fel uppstod vid val av bortaläges-symbol');
    } finally {
      setIsLoading(false);
    }
  };

  // Modified to check current status taking away mode into account
  const isCurrentlyOpen = (): boolean => {
    // Always check away mode first - if active, we're not open
    if (manualOverride) {
      return false;
    }
    
    // If not in away mode, check schedule as usual
    const currentDayIndex = getCurrentDayIndex();
    const currentDay = scheduleData[currentDayIndex];
    
    if (!currentDay) return false;
    
    return currentDay.times.some(timeSlot => {
      const startMinutes = timeToMinutes(timeSlot.start);
      const endMinutes = timeToMinutes(timeSlot.end);
      return currentTimeMinutes >= startMinutes && currentTimeMinutes < endMinutes;
    });
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
            <Typography variant="h6" sx={{ flexGrow: 1 }}>LLSSYS</Typography>
            
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
        ) : activeTab === 0 ? (
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
              isCurrentlyOpen={isCurrentlyOpen()} // Pass the calculated status
            />
          ) : activeTab === 1 ? (
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
              manualoverride={manualOverride} // Pass away mode state
            />
          ) : (
            <MeetingsScreen 
              isLoggedIn={isLoggedIn}
              currentUser={currentUser}
            />
          )}

        <Paper sx={{ position: 'fixed', bottom: 0, left: 0, right: 0 }} elevation={3}>
          <BottomNavigation
            showLabels
            value={activeTab}
            onChange={(event, newValue) => setActiveTab(newValue)}
          >
            <BottomNavigationAction label="Just nu" icon={<Circle size={24} />} />
            <BottomNavigationAction label="Schema" icon={<Calendar size={24} />} />
            <BottomNavigationAction label="Möten" icon={<Gavel size={24} />} />
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