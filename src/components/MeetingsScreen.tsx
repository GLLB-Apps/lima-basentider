import React, { useState, useEffect, useMemo } from 'react';
import {
  Box, Typography, Paper, List, ListItem, ListItemText, 
  ListItemIcon, Divider, Button, TextField, Dialog, 
  DialogTitle, DialogContent, DialogActions, Chip, Tabs, Tab,
  Fab, IconButton, CircularProgress, Badge, useMediaQuery, useTheme,
  Container, Snackbar, Alert
} from '@mui/material';
import { Plus, Edit, Trash, Gavel, Clock as ClockIcon, Calendar as CalendarIcon, Inbox, SquareCheckBig } from 'lucide-react';
import Clock from 'react-clock'; // Import the Clock component
import 'react-clock/dist/Clock.css'; // Import the styles
import ClockDayCard, { fullDayNames, dayColors } from '../components/ClockDayCard'; // Import the ClockDayCard component
import { User as UserType, InboxMessage, Meeting } from '../types';
import { 
  getInboxMessages, createInboxMessage, 
  markMessageAsRead, deleteInboxMessage,
  getAllMeetings, createMeeting, updateMeeting, deleteMeeting as deleteMeetingService
} from '../services/appwriteService';

// Calendar icon URL - this is a basic example, replace with your actual icon
const calendarIconUrl = "data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22850.394%22%20height%3D%22850.394%22%20viewBox%3D%220%200%20850.394%20850.394%22%20overflow%3D%22visible%22%3E%3Cpath%20fill%3D%22%23ff001c%22%20d%3D%22M696.88%20111.76v119.33h-.22v-.44H154.9V111.76z%22%2F%3E%3Cpath%20fill%3D%22%23fff%22%20d%3D%22M561.22%20636.97h135.44v135.44H561.22zM561.22%20501.53h135.44v135.439H561.22zM561.22%20366.09h135.44v135.44H561.22z%22%2F%3E%3Cpath%20fill%3D%22%23fff%22%20d%3D%22M561.22%20231.09h135.44v135H561.22zM425.78%20636.97h135.44v135.44H425.78zM425.78%20501.53h135.44v135.439H425.78zM425.78%20366.09h135.44v135.44H425.78z%22%2F%3E%3Cpath%20fill%3D%22%23fff%22%20d%3D%22M425.78%20231.09h135.44v135H425.78zM290.34%20636.97h135.44v135.44H290.34zM290.34%20501.53h135.44v135.439H290.34zM290.34%20366.09h135.44v135.44H290.34z%22%2F%3E%3Cpath%20fill%3D%22%23fff%22%20d%3D%22M290.34%20231.09h135.44v135H290.34zM154.9%20636.97h135.44v135.44H154.9zM154.9%20501.53h135.44v135.439H154.9z%22%2F%3E%3Cpath%20fill%3D%22%23fff%22%20d%3D%22M154.9%20366.09h135.44v135.44H154.9z%22%2F%3E%3Cpath%20fill%3D%22%23fff%22%20d%3D%22M154.9%20231.09h135.44v135H154.9z%22%2F%3E%3Cg%20fill%3D%22none%22%20stroke%3D%22%23231f20%22%3E%3Cpath%20stroke-width%3D%2221%22%20d%3D%22M154.9%20230.65h541.76v541.76H154.9V231.09M154.9%20636.97h541.76M154.9%20501.53h541.76M154.9%20366.09h541.76M561.22%20230.65v541.76M425.78%20230.65v541.76M290.34%20230.65v541.76%22%2F%3E%3Cpath%20stroke-width%3D%2221%22%20d%3D%22M154.9%20230.65V111.76h541.98v119.33H154.9z%22%2F%3E%3Cpath%20stroke-width%3D%2227.872%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%20d%3D%22M176.79%2082.73v21.22M225.56%2082.73v21.22M275.5%2082.82v21.21M324.27%2082.98v21.21M374.21%2083.31v21.21M425.78%2083.46v21.21M474.56%2083.46v21.21M524.49%2083.54v21.21M573.26%2083.71v21.21M623.2%2084.04v21.21M675.32%2082.83v21.21%22%2F%3E%3C%2Fg%3E%3Cpath%20fill%3D%22none%22%20d%3D%22M0%200h850.394v850.394H0z%22%2F%3E%3C%2Fsvg%3E";

// Helper to get day of week from date string (YYYY-MM-DD)
const getDayOfWeek = (dateString: string): string => {
  const date = new Date(dateString);
  const dayIndex = date.getDay();
  // Convert to Swedish day abbreviations (0 = Sunday in JS but we want to map to Swedish where 0 = Monday)
  const swedishDays = ['Sön', 'Mån', 'Tis', 'Ons', 'Tors', 'Fre', 'Lör'];
  return swedishDays[dayIndex];
};

// Helper to get current day abbreviation
const getCurrentDayAbbreviation = (): string => {
  const date = new Date();
  const dayIndex = date.getDay();
  const swedishDays = ['Sön', 'Mån', 'Tis', 'Ons', 'Tors', 'Fre', 'Lör'];
  return swedishDays[dayIndex];
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

// Helper to get color for day of week - SINGLE SOURCE OF TRUTH FOR COLORS
const getDayColor = (day: string): string => {
  const colorMap: Record<string, string> = {
    'Mån': '#81ee6b', // Blue
    'Tis': '#79c9f8', // Green
    'Ons': '#ffffff', // Yellow
    'Tors': '#c99364', // Red
    'Fre': '#e4cf86', // Purple
    'Lör': '#fab9b7', // Orange
    'Sön': '#f37a7a'  // Brown
  };

  return colorMap[day] || '#1976D2'; // Default to blue
};

// Helper function to create a Date object with a specific time (default 18:00)
const createMeetingTimeDate = (dateString: string, timeString: string = "18:00"): Date => {
  const [year, month, day] = dateString.split('-').map(num => parseInt(num, 10));
  const [hours, minutes] = timeString.split(':').map(num => parseInt(num, 10));
  
  const meetingDate = new Date();
  meetingDate.setFullYear(year);
  meetingDate.setMonth(month - 1); // Month is 0-indexed in JS
  meetingDate.setDate(day);
  meetingDate.setHours(hours || 10);
  meetingDate.setMinutes(minutes || 0);
  meetingDate.setSeconds(0);
  
  return meetingDate;
};

interface MeetingsScreenProps {
  isLoggedIn: boolean;
  currentUser: UserType | null;
}

// Fix to make the component a proper React Functional Component
const MeetingsScreen: React.FC<MeetingsScreenProps> = ({ isLoggedIn, currentUser }) => {
  // Use theme and media queries for responsive design
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  
  // Current day and clock state
  const [clockTime, setClockTime] = useState(new Date());
  
  // Current day information - use useMemo to prevent recalculation
  const currentDayAbbreviation = useMemo(() => getCurrentDayAbbreviation(), []);
  const currentFullDayName = useMemo(() => fullDayNames[currentDayAbbreviation] || currentDayAbbreviation, [currentDayAbbreviation]);
  const currentDateString = useMemo(() => getCurrentDateString(), []);
  const currentDayColor = useMemo(() => getDayColor(currentDayAbbreviation) + '88', [currentDayAbbreviation]);
  
  // Tab state
  const [activeTab, setActiveTab] = useState(0);

  // Meetings state
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
  const [meetingDialogOpen, setMeetingDialogOpen] = useState(false);
  const [isEditingMeeting, setIsEditingMeeting] = useState(false);
  const [isLoadingMeetings, setIsLoadingMeetings] = useState(false);
  const [isSavingMeeting, setIsSavingMeeting] = useState(false);
  
  // Inbox state
  const [inboxMessages, setInboxMessages] = useState<InboxMessage[]>([]);
  const [inboxDialogOpen, setInboxDialogOpen] = useState(false);
  const [isLoadingInbox, setIsLoadingInbox] = useState(false);
  const [isSubmittingMessage, setIsSubmittingMessage] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  
  // Meeting time state - For demonstration, using a fixed time (18:00 AM)
  // In a real app, you might want to store meeting times in your database
  const [meetingTime, setMeetingTime] = useState("18:00");
  
  // Snackbar notification state
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success' as 'success' | 'error' | 'info' | 'warning'
  });
  
  // Simplified Meeting Form state
  const [meetingFormData, setMeetingFormData] = useState({
    date: '',
    time: "18:00" // Default time
  });
  
  // Inbox Form state
  const [inboxFormData, setInboxFormData] = useState({
    title: '',
    content: ''
  });
  // Clock update effect
  useEffect(() => {
    // Update the clock time every second
    const clockInterval = setInterval(() => {
      setClockTime(new Date());
    }, 1000);
    
    // Clean up the interval when component unmounts
    return () => clearInterval(clockInterval);
  }, []);

  // Load meetings when the component mounts
  useEffect(() => {
    loadMeetings();
  }, []);

  // Load inbox messages when the component mounts or when logged in
  useEffect(() => {
    if (isLoggedIn) {
      loadInboxMessages();
    }
  }, [isLoggedIn]);

  // Load inbox messages when active tab changes to inbox
  useEffect(() => {
    if (activeTab === 1 && isLoggedIn) {
      loadInboxMessages();
    }
  }, [activeTab, isLoggedIn]);

  // Update unread count whenever inbox messages change
  useEffect(() => {
    const count = inboxMessages.filter(message => !message.isRead).length;
    setUnreadCount(count);
  }, [inboxMessages]);

  // Load meetings from the API
  const loadMeetings = async () => {
    if (!isLoadingMeetings) {
      setIsLoadingMeetings(true);
      try {
        const fetchedMeetings = await getAllMeetings();
        setMeetings(fetchedMeetings);
      } catch (error) {
        console.error('Error loading meetings:', error);
        showSnackbar('Kunde inte hämta möten', 'error');
      } finally {
        setIsLoadingMeetings(false);
      }
    }
  };
  
  // Load inbox messages from the API
  const loadInboxMessages = async () => {
    if (!isLoadingInbox && isLoggedIn) {
      setIsLoadingInbox(true);
      try {
        const messages = await getInboxMessages();
        setInboxMessages(messages);
      } catch (error) {
        console.error('Error loading inbox messages:', error);
        showSnackbar('Kunde inte hämta meddelanden', 'error');
      } finally {
        setIsLoadingInbox(false);
      }
    }
  };
  
  // Handle tab change
  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  // Snackbar helper
  const showSnackbar = (message: string, severity: 'success' | 'error' | 'info' | 'warning' = 'success') => {
    setSnackbar({
      open: true,
      message,
      severity
    });
  };

  const handleCloseSnackbar = () => {
    setSnackbar({
      ...snackbar,
      open: false
    });
  };

  // Meeting functions
  const handleOpenMeetingDialog = (meeting?: Meeting) => {
    if (!isLoggedIn) {
      showSnackbar('Du måste vara inloggad för att hantera möten', 'info');
      return;
    }
    
    if (meeting) {
      setSelectedMeeting(meeting);
      setMeetingFormData({
        date: meeting.date,
        time: meetingTime // Use the existing time or a default
      });
      setIsEditingMeeting(true);
    } else {
      setSelectedMeeting(null);
      setMeetingFormData({
        date: getTodayDate(),
        time: "18:00" // Default time
      });
      setIsEditingMeeting(false);
    }
    setMeetingDialogOpen(true);
  };
  
  const handleCloseMeetingDialog = () => {
    setMeetingDialogOpen(false);
  };
  
  const handleMeetingInputChange = (e: React.ChangeEvent<HTMLInputElement | { name?: string; value: unknown }>) => {
    const { name, value } = e.target;
    if (name) {
      setMeetingFormData({
        ...meetingFormData,
        [name]: value as string
      });
    }
  };
  
  const handleSaveMeeting = async () => {
    // Only allow logged-in users to save meetings
    if (!isLoggedIn) {
      showSnackbar('Du måste vara inloggad för att hantera möten', 'error');
      return;
    }
    
    // Validate form data
    if (!meetingFormData.date) {
      return;
    }
    
    setIsSavingMeeting(true);
    
    try {
      if (isEditingMeeting && selectedMeeting) {
        // Update existing meeting
        const success = await updateMeeting(selectedMeeting.id, meetingFormData.date);
        
        if (success) {
          // Update in local state
          const updatedMeetings = meetings.map(meeting => 
            meeting.id === selectedMeeting.id 
              ? { 
                  ...meeting, 
                  date: meetingFormData.date
                }
              : meeting
          );
          setMeetings(updatedMeetings);
          
          // Also update the meeting time (in a real app, you would save this to your database)
          setMeetingTime(meetingFormData.time);
          
          showSnackbar('Mötet har uppdaterats');
        } else {
          throw new Error('Kunde inte uppdatera mötet');
        }
      } else {
        // Create new meeting
        const newMeeting = await createMeeting(meetingFormData.date);
        
        if (newMeeting) {
          // Add to local state
          setMeetings([...meetings, newMeeting]);
          
          // Also set the meeting time (in a real app, you would save this to your database)
          setMeetingTime(meetingFormData.time);
          
          showSnackbar('Nytt möte har skapats');
        } else {
          throw new Error('Kunde inte skapa nytt möte');
        }
      }
      
      handleCloseMeetingDialog();
    } catch (error) {
      console.error('Error saving meeting:', error);
      showSnackbar('Ett fel uppstod vid sparande av mötet', 'error');
    } finally {
      setIsSavingMeeting(false);
    }
  };
  
  const handleDeleteMeeting = async (id: string) => {
    // Only allow logged-in users to delete meetings
    if (!isLoggedIn) {
      showSnackbar('Du måste vara inloggad för att hantera möten', 'error');
      return;
    }
    
    try {
      const success = await deleteMeetingService(id);
      
      if (success) {
        // Remove from local state
        setMeetings(meetings.filter(meeting => meeting.id !== id));
        showSnackbar('Mötet har tagits bort');
      } else {
        throw new Error('Kunde inte ta bort mötet');
      }
    } catch (error) {
      console.error('Error deleting meeting:', error);
      showSnackbar('Ett fel uppstod vid borttagning av mötet', 'error');
    }
  };
  // Inbox functions
  const handleOpenInboxDialog = () => {
    setInboxFormData({
      title: '',
      content: ''
    });
    setInboxDialogOpen(true);
  };
  
  const handleCloseInboxDialog = () => {
    setInboxDialogOpen(false);
  };
  
  const handleInboxInputChange = (e: React.ChangeEvent<HTMLInputElement | { name?: string; value: unknown }>) => {
    const { name, value } = e.target;
    if (name) {
      setInboxFormData({
        ...inboxFormData,
        [name]: value as string
      });
    }
  };
  
  // Submit a new message to the inbox
  const handleSaveInboxMessage = async () => {
    // Validate form data
    if (!inboxFormData.title || !inboxFormData.content) {
      return;
    }
    
    setIsSubmittingMessage(true);
    try {
      // Send message to API
      const newMessage = await createInboxMessage({
        title: inboxFormData.title,
        content: inboxFormData.content
      });
      
      if (newMessage) {
        // Add new message to state if logged in
        if (isLoggedIn) {
          setInboxMessages([newMessage, ...inboxMessages]);
        }
        handleCloseInboxDialog();
        showSnackbar('Ditt meddelande har skickats', 'success');
      }
    } catch (error) {
      console.error('Error submitting message:', error);
      showSnackbar('Ett fel uppstod vid skickande av meddelandet', 'error');
    } finally {
      setIsSubmittingMessage(false);
    }
  };
  
  // Mark a message as read
  const handleMarkAsRead = async (id: string) => {
    try {
      const success = await markMessageAsRead(id);
      if (success) {
        // Update message in state
        setInboxMessages(inboxMessages.map(message => 
          message.id === id 
            ? { ...message, isRead: true } 
            : message
        ));
        showSnackbar('Meddelandet har markerats som läst');
      }
    } catch (error) {
      console.error('Error marking message as read:', error);
      showSnackbar('Ett fel uppstod vid markering av meddelandet', 'error');
    }
  };
  
  // Delete a message
  const handleDeleteMessage = async (id: string) => {
    try {
      const success = await deleteInboxMessage(id);
      if (success) {
        // Remove message from state
        setInboxMessages(inboxMessages.filter(message => message.id !== id));
        showSnackbar('Meddelandet har tagits bort');
      }
    } catch (error) {
      console.error('Error deleting message:', error);
      showSnackbar('Ett fel uppstod vid borttagning av meddelandet', 'error');
    }
  };
  
  // Helper function to get today's date in YYYY-MM-DD format
  const getTodayDate = (): string => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  
  // Format date to Swedish format (DD/MM/YYYY)
  const formatDate = (dateString: string): string => {
    const [year, month, day] = dateString.split('-');
    
    // Remove leading zero from day
    const dayNum = parseInt(day, 10);
    
    // Get month name in Swedish
    const monthNames = ['januari', 'februari', 'mars', 'april', 'maj', 'juni', 
                       'juli', 'augusti', 'september', 'oktober', 'november', 'december'];
    const monthIndex = parseInt(month, 10) - 1; // Convert to 0-based index
    const monthName = monthNames[monthIndex];
    
    return `${dayNum} ${monthName} ${year}`;
  };
  // Render the meetings tab content
  const renderMeetingsTab = () => {
    return (
      <Box sx={{ position: 'relative', minHeight: '400px' }}>
        {/* Header with add button for logged in users */}
        {isLoggedIn && !isMobile && (
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
            <Button 
              variant="outlined"
              onClick={loadMeetings}
              disabled={isLoadingMeetings}
              startIcon={isLoadingMeetings ? <CircularProgress size={16} /> : null}
              size={isMobile ? "small" : "medium"}
            >
              {isLoadingMeetings ? 'Uppdaterar...' : 'Uppdatera'}
            </Button>
            
            <Button 
              variant="contained" 
              startIcon={<Plus size={16} />}
              onClick={() => handleOpenMeetingDialog()}
              size={isMobile ? "small" : "medium"}
            >
              Lägg till basmöte
            </Button>
          </Box>
        )}
        
        {/* Meetings list */}
        {isLoadingMeetings && meetings.length === 0 ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '300px' }}>
            <CircularProgress />
          </Box>
        ) : (
          <Paper elevation={2} sx={{ overflow: 'hidden' }}>
            <List sx={{ p: 0 }}>
              {meetings.length === 0 ? (
                <ListItem>
                  <ListItemText primary="Inga möten schemalagda" />
                </ListItem>
              ) : (
                meetings.map((meeting, index) => {
                  const dayOfWeek = getDayOfWeek(meeting.date);
                  // Apply the same color calculation as used for the header
                  const dayColor = getDayColor(dayOfWeek) + '88';
                  const fullDayName = fullDayNames[dayOfWeek] || dayOfWeek;
                  
                  // Create a Date object for the meeting time
                  const meetingDateTime = createMeetingTimeDate(meeting.date, meetingTime);
                  
                  // Responsive layout based on screen size
                  return (
                    <React.Fragment key={meeting.id}>
                      {index > 0 && <Divider />}
                      
                      {/* Mobile layout */}
                      {isMobile ? (
                        <ListItem 
                          sx={{ 
                            py: 2,
                            px: 2,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1.5
                          }}
                        >
                          {/* Calendar Icon as simple img */}
                          <Box 
                            component="div"
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              mr: 0.5,
                              flex: '0 0 auto',
                            }}
                          >
                            <img 
                              src={calendarIconUrl} 
                              alt="Calendar" 
                              width="48" 
                              height="48"
                            />
                          </Box>
                          
                          {/* Day Card - Using consistent styling */}
                          <Paper 
                            elevation={1} 
                            sx={{ 
                              px: 1.5, 
                              py: 0.75, 
                              borderRadius: 2,
                              bgcolor: dayColor,
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              justifyContent: 'center',
                              minWidth: 70,
                              flex: '0 0 auto'
                            }}
                          >
                            <Typography 
                              variant="body2" 
                              sx={{ 
                                fontWeight: 'bold', 
                                color: 'rgba(0,0,0,0.85)',
                                mb: 0.25,
                                fontSize: '0.8rem'
                              }}
                            >
                              {fullDayName}
                            </Typography>
                            <Typography 
                              variant="caption" 
                              sx={{ 
                                color: 'rgba(0,0,0,0.7)',
                                fontSize: '0.65rem'
                              }}
                            >
                              {formatDate(meeting.date)}
                            </Typography>
                          </Paper>
                          
                          {/* Meeting Title */}
                          <Box sx={{ 
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            flex: '1 1 auto'
                          }}>
                            <Typography variant="h6" fontWeight="medium" noWrap sx={{ mr: 1, maxWidth: '110px' }}>
                              Basmöte
                            </Typography>
                          </Box>
                          
                          {/* Analog Clock representing meeting time */}
                          <Box 
                            component="div"
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flex: '0 0 auto',
                              p: 1,
                              borderRadius: '50%',
                              bgcolor: 'background.paper',
                              boxShadow: 1,
                              width: 60,
                              height: 60
                            }}
                          >
                            <Clock 
                              value={meetingDateTime}
                              size={50}
                              renderNumbers={false}
                              hourHandLength={20}
                              hourHandWidth={3}
                              minuteHandLength={30}
                              minuteHandWidth={2}
                              secondHandLength={0} // No seconds hand on mobile
                              renderSecondHand={false}
                              renderMinuteMarks={false}
                            />
                          </Box>
                          
                          {/* Edit/Delete icons only for logged in users */}
                          {isLoggedIn && (
                            <IconButton 
                              edge="end" 
                              color="error" 
                              onClick={() => handleDeleteMeeting(meeting.id)}
                              sx={{ 
                                ml: 0.5,
                                p: 0.75
                              }}
                              size="small"
                            >
                              <Trash size={16} />
                            </IconButton>
                          )}
                        </ListItem>
                      ) : (
                        /* Desktop layout */
                        <ListItem 
                          sx={{ 
                            py: 3,
                            px: 3,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 2.5
                          }}
                        >
                          {/* Calendar Icon as simple img */}
                          <Box 
                            component="div"
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flex: '0 0 auto',
                              mr: 0.5
                            }}
                          >
                            <img 
                              src={calendarIconUrl} 
                              alt="Calendar" 
                              width="48" 
                              height="48"
                            />
                          </Box>
                          
                          {/* Day Card - Using consistent styling */}
                          <Paper 
                            elevation={1} 
                            sx={{ 
                              px: 2.5, 
                              py: 1.25, 
                              borderRadius: 2,
                              bgcolor: dayColor,
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              justifyContent: 'center',
                              minWidth: 100,
                              flex: '0 0 auto'
                            }}
                          >
                            <Typography 
                              variant="h6" 
                              sx={{ 
                                fontWeight: 'bold', 
                                color: 'rgba(0,0,0,0.85)',
                                mb: 0.5
                              }}
                            >
                              {fullDayName}
                            </Typography>
                            <Typography 
                              variant="body2" 
                              sx={{ color: 'rgba(0,0,0,0.7)' }}
                            >
                              {formatDate(meeting.date)}
                            </Typography>
                          </Paper>
                          
                          {/* Meeting Title with Time */}
                          <Box sx={{ 
                            flexGrow: 1,
                            display: 'flex',
                            flexDirection: 'column'
                          }}>
                            <Typography variant="h5" fontWeight="medium">
                              Basmöte
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                              Tid: {meetingTime}
                            </Typography>
                          </Box>
                          
                          {/* Analog Clock representing meeting time */}
                          <Box 
                            component="div"
                            sx={{
                              minWidth: 80,
                              minHeight: 80,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flex: '0 0 auto',
                              
                              borderRadius: '50%',
                              bgcolor: 'background.paper',
                              boxShadow: 2,
                              width: 80,
                              height: 80
                            }}
                          >
                            <Clock 
                              value={meetingDateTime}
                              size={70}
                              renderNumbers={false}
                              hourHandLength={60}
                              hourHandWidth={3}
                              minuteHandLength={80}
                              minuteHandWidth={2}
                              secondHandLength={0} // No seconds hand needed
                              renderSecondHand={false}
                              renderMinuteMarks={false}
                            />
                          </Box>
                          
                          {/* Icons only for logged in users */}
                          {isLoggedIn && (
                            <Box sx={{ display: 'flex', gap: 1 }}>
                              <IconButton 
                                color="primary" 
                                onClick={() => handleOpenMeetingDialog(meeting)}
                              >
                                <Edit size={20} />
                              </IconButton>
                              <IconButton 
                                color="error" 
                                onClick={() => handleDeleteMeeting(meeting.id)}
                              >
                                <Trash size={20} />
                              </IconButton>
                            </Box>
                          )}
                        </ListItem>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </List>
          </Paper>
        )}
        
        {/* Floating Action Button for mobile */}
        {isLoggedIn && isMobile && (
          <Fab 
            color="primary" 
            
            sx={{ position: 'fixed', bottom: 70, right: 16 }}
            onClick={() => handleOpenMeetingDialog()}
          >
            <Plus size={24} />
          </Fab>
        )}
      </Box>
    );
  };
  // Render the inbox tab content
  const renderInboxTab = () => {
    if (!isLoggedIn) {
      // For non-logged-in users: A big box with a big plus icon
      return (
        <>
          <Paper 
            elevation={3} 
            sx={{ 
              height: '400px',
              display: 'flex', 
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              position: 'relative',
              borderRadius: 4,
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              '&:hover': {
                boxShadow: 6,
                transform: 'translateY(-4px)'
              }
            }}
            onClick={handleOpenInboxDialog}
          >
            <Box sx={{ 
              width: '100px', 
              height: '100px', 
              borderRadius: '50%', 
              bgcolor: 'primary.main',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              mb: 3
            }}>
              <Plus size={60} color="white" />
            </Box>
            
            <Typography variant="h5" gutterBottom>
              Lägg en lapp i lådan
            </Typography>
            
            <Typography variant="body1" color="text.secondary" align="center" sx={{ maxWidth: '60%' }}>
              Klicka här för att lägga en lapp i lådan.
            </Typography>
          </Paper>
        </>
      );
    }
    
    // For logged-in users: Grid of cards showing submissions
    return (
      <>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center' }}>
            <Inbox size={20} style={{ marginRight: '8px' }} />
            Inkorg - Meddelanden
          </Typography>
          
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button 
              variant="outlined"
              onClick={loadInboxMessages}
              disabled={isLoadingInbox}
              startIcon={isLoadingInbox ? <CircularProgress size={16} /> : null}
              size={isMobile ? "small" : "medium"}
            >
              {isLoadingInbox ? 'Uppdaterar...' : 'Uppdatera'}
            </Button>
            
            {!isMobile && (
              <Button 
                variant="contained" 
                startIcon={<Plus size={16} />}
                onClick={handleOpenInboxDialog}
                size={isMobile ? "small" : "medium"}
              >
                Lägg till meddelande
              </Button>
            )}
          </Box>
        </Box>
        
        {isLoadingInbox ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '300px' }}>
            <CircularProgress />
          </Box>
        ) : inboxMessages.length === 0 ? (
          <Paper 
            elevation={2} 
            sx={{ 
              minHeight: '200px', 
              display: 'flex', 
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              p: 3
            }}
          >
            <Inbox size={40} style={{ opacity: 0.5, marginBottom: '16px' }} />
            <Typography variant="h6" color="text.secondary">
              Ingenting i lådan ännu...
            </Typography>
            <Typography color="text.secondary">
              Brukarna har inte lagt några lappar i lådan.
            </Typography>
          </Paper>
        ) : (
          <Box sx={{ 
            display: 'grid', 
            gridTemplateColumns: isMobile 
              ? 'repeat(1, 1fr)' 
              : 'repeat(auto-fill, minmax(280px, 1fr))', 
            gap: isMobile ? 2 : 3 
          }}>
            {inboxMessages.map((message) => (
              <Paper
                key={message.id}
                elevation={message.isRead ? 1 : 3}
                sx={{ 
                  p: 2, 
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  position: 'relative',
                  borderLeft: message.isRead ? 'none' : '4px solid',
                  borderColor: 'primary.main'
                }}
              >
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                  <Typography 
                    variant="h6" 
                    sx={{ 
                      fontWeight: message.isRead ? 'normal' : 'bold',
                      mb: 1,
                      fontSize: isMobile ? '1.1rem' : '1.25rem'
                    }}
                  >
                    {message.title}
                  </Typography>
                  
                  {!message.isRead && (
                    <Chip 
                      label="Ny" 
                      color="primary" 
                      size="small" 
                      sx={{ ml: 1 }}
                    />
                  )}
                </Box>
                
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Mottaget: {formatDate(message.date)}
                </Typography>
                
                <Typography 
                  variant="body1" 
                  sx={{ 
                    mb: 2, 
                    flexGrow: 1,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    display: '-webkit-box',
                    WebkitLineClamp: 4,
                    WebkitBoxOrient: 'vertical'
                  }}
                >
                  {message.content}
                </Typography>
                
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 'auto' }}>
                  {message.isRead ? (
                    <Button 
                      startIcon={<Trash size={16} />} 
                      color="error"
                      onClick={() => handleDeleteMessage(message.id)}
                      size={isMobile ? "small" : "medium"}
                    >
                      Ta bort
                    </Button>
                  ) : (
                    <>
                      <Button 
                        sx={{ mr: 1 }}
                        onClick={() => handleMarkAsRead(message.id)}
                        startIcon={<SquareCheckBig size={16} />}
                        size={isMobile ? "small" : "medium"}
                      >
                        Markera som läst
                      </Button>
                      <Button 
                        startIcon={<Trash size={16} />} 
                        color="error"
                        onClick={() => handleDeleteMessage(message.id)}
                        size={isMobile ? "small" : "medium"}
                      >
                        Ta bort
                      </Button>
                    </>
                  )}
                </Box>
              </Paper>
            ))}
          </Box>
        )}
        
        {/* Floating Action Button for mobile */}
        {isMobile && (
          <Fab 
            color="primary"
            size="medium" 
            sx={{ position: 'fixed', bottom: 16, right: 16 }}
            onClick={handleOpenInboxDialog}
          >
            <Plus size={24} />
          </Fab>
        )}
      </>
    );
  };
  return (
    <Box sx={{ p: isMobile ? 1 : 2 }}>
      {/* Header with current day and clock - REPLACED WITH CLOCKDAYCARD COMPONENT */}
      <Box sx={{ textAlign: 'center', mb: isMobile ? 2 : 3 }}>
        {isMobile ? (
          // Mobile view - Column layout
          <ClockDayCard
            time={clockTime}
            day={currentDayAbbreviation}
            date={currentDateString}
            dayCardColor={getDayColor(currentDayAbbreviation)}
            direction="column"
            gap={2}
            dayCardMinWidth="80%"
            clockSize={100}
            clockContainerSize={120}
            showSeconds={false}
            dayCardElevation={2}
            dayCardPaperProps={{
              sx: {
                width: '100%',
                maxWidth: '300px'
              }
            }}
          />
        ) : (
          // Desktop view - Row layout
          <ClockDayCard
            time={clockTime}
            day={currentDayAbbreviation}
            date={currentDateString}
            dayCardColor={getDayColor(currentDayAbbreviation)}
            direction="row"
            gap={4}
            dayCardMinWidth={150}
            clockSize={140}
            clockContainerSize={160}
            showSeconds={true}
            hourHandWidth={4}
            minuteHandWidth={2}
            secondHandWidth={1}
            hourHandLength={50}
            minuteHandLength={70}
            secondHandLength={75}
          />
        )}
      </Box>
    
      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: isMobile ? 1.5 : 2 }}>
        <Tabs 
          value={activeTab} 
          onChange={handleTabChange} 
          aria-label="module tabs"
          variant={isMobile ? "fullWidth" : "standard"}
        >
          <Tab label="Möten" />
          <Tab 
            label={
              isLoggedIn && unreadCount > 0 ? (
                <Box sx={{ display: 'inline-flex', alignItems: 'center', position: 'relative', pr: 3 }}>
                  Förslagslåda
                  <Badge 
                    badgeContent={unreadCount} 
                    color="error"
                    sx={{
                      position: 'absolute',
                      right: isMobile ? 0 : 10,
                      top: -2
                    }}
                  />
                </Box>
              ) : (
                "Förslagslåda"
              )
            } 
          />
        </Tabs>
      </Box>
      
      {/* Tab Content */}
      {activeTab === 0 ? renderMeetingsTab() : renderInboxTab()}
      
      {/* Simplified Meeting Dialog - Now with Time field */}
      <Dialog 
        open={meetingDialogOpen} 
        onClose={handleCloseMeetingDialog} 
        maxWidth="sm" 
        fullWidth
        fullScreen={isMobile}
      >
        <DialogTitle>
          {isEditingMeeting ? 'Redigera basmöte' : 'Nytt basmöte'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="Datum"
              name="date"
              type="date"
              value={meetingFormData.date}
              onChange={handleMeetingInputChange}
              fullWidth
              InputLabelProps={{ shrink: true }}
              required
              size={isMobile ? "small" : "medium"}
              margin={isMobile ? "dense" : "normal"}
              disabled={isSavingMeeting}
            />
            
            {/* Added Time input field */}
            <TextField
              label="Tid"
              name="time"
              type="time"
              value={meetingFormData.time}
              onChange={handleMeetingInputChange}
              fullWidth
              InputLabelProps={{ shrink: true }}
              required
              size={isMobile ? "small" : "medium"}
              margin={isMobile ? "dense" : "normal"}
              disabled={isSavingMeeting}
              inputProps={{
                step: 300, // 5 minutes
              }}
            />
            
            {/* Current time preview with analog clock */}
            <Box sx={{ 
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              mt: 1,
              mb: 1
            }}>
              <Typography variant="subtitle1" sx={{ mb: 1 }}>
                Förhandsgranskning av mötestid:
              </Typography>
              <Box sx={{ 
                p: 2, 
                borderRadius: '50%', 
                bgcolor: 'background.paper',
                boxShadow: 2,
                width: 120,
                height: 120,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <Clock 
                  value={createMeetingTimeDate(
                    meetingFormData.date || getTodayDate(), 
                    meetingFormData.time
                  )}
                  size={100}
                  renderNumbers={false}
                  hourHandLength={40}
                  hourHandWidth={3}
                  minuteHandLength={60}
                  minuteHandWidth={2}
                  secondHandLength={0}
                  renderSecondHand={false}
                  renderMinuteMarks={true}
                  minuteMarksLength={5}
                  hourMarksLength={10}
                />
              </Box>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={handleCloseMeetingDialog}
            disabled={isSavingMeeting}
          >
            Avbryt
          </Button>
          <Button 
            onClick={handleSaveMeeting} 
            variant="contained"
            disabled={!meetingFormData.date || !meetingFormData.time || isSavingMeeting}
            startIcon={isSavingMeeting ? <CircularProgress size={16} color="inherit" /> : null}
          >
            {isSavingMeeting ? 'Sparar...' : 'Spara'}
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Inbox Dialog */}
      <Dialog 
        open={inboxDialogOpen} 
        onClose={handleCloseInboxDialog} 
        maxWidth="sm" 
        fullWidth
        fullScreen={isMobile}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center' }}>
          <Inbox size={20} style={{ marginRight: '8px' }} />
          Lägg en lapp i lådan
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1, mb: 2 }}>
            Fyll i nedan för att lägga en lapp i lådan. Vi kommer att läsa den på nästa möte.
          </Typography>
          
          <TextField
            label="Ämne"
            name="title"
            value={inboxFormData.title}
            onChange={handleInboxInputChange}
            fullWidth
            margin={isMobile ? "dense" : "normal"}
            required
            disabled={isSubmittingMessage}
            placeholder="Vad gäller ditt meddelande?"
            size={isMobile ? "small" : "medium"}
          />
          
          <TextField
            label="Meddelande"
            name="content"
            value={inboxFormData.content}
            onChange={handleInboxInputChange}
            fullWidth
            margin={isMobile ? "dense" : "normal"}
            multiline
            rows={isMobile ? 4 : 6}
            required
            disabled={isSubmittingMessage}
            placeholder="Skriv ditt meddelande här..."
            size={isMobile ? "small" : "medium"}
          />
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={handleCloseInboxDialog}
            disabled={isSubmittingMessage}
          >
            Avbryt
          </Button>
          <Button 
            onClick={handleSaveInboxMessage} 
            variant="contained" 
            startIcon={isSubmittingMessage ? <CircularProgress size={16} color="inherit" /> : null}
            disabled={!inboxFormData.title || !inboxFormData.content || isSubmittingMessage}
          >
            {isSubmittingMessage ? 'Skickar...' : 'Skicka'}
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Snackbar for notifications */}
      <Snackbar 
        open={snackbar.open} 
        autoHideDuration={6000} 
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert 
          onClose={handleCloseSnackbar} 
          severity={snackbar.severity} 
          variant="filled"
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default MeetingsScreen;