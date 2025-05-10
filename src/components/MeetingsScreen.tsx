import React, { useState, useEffect, useMemo } from 'react';
import {
  Box, Typography, Paper, List, ListItem, ListItemText, 
  ListItemIcon, Divider, Button, TextField, Dialog, 
  DialogTitle, DialogContent, DialogActions, Chip, Tabs, Tab,
  Fab, IconButton, CircularProgress, Badge, useMediaQuery, useTheme,
  Container
} from '@mui/material';
import { Plus, Edit, Trash, Gavel, Clock as ClockIcon, Calendar as CalendarIcon, Inbox, SquareCheckBig } from 'lucide-react';
import Clock from 'react-clock'; // Make sure to import the Clock component
import 'react-clock/dist/Clock.css'; // Import the styles
import { User as UserType, InboxMessage } from '../types';
import { 
  getInboxMessages, createInboxMessage, 
  markMessageAsRead, deleteInboxMessage 
} from '../services/appwriteService';

// Define simplified Meeting interface
interface Meeting {
  id: string;
  title: string;
  date: string;
  time: string;
  description: string;
  status: 'scheduled' | 'completed' | 'cancelled';
}

// Mock data for meetings
const mockMeetings: Meeting[] = [
  {
    id: '1',
    title: 'Basmöte',
    date: '2025-05-10',
    time: '13:00',
    description: '',
    status: 'scheduled'
  },
  {
    id: '2',
    title: 'Basmöte',
    date: '2025-05-15',
    time: '10:00',
    description: '',
    status: 'scheduled'
  },
  {
    id: '3',
    title: 'Basmöte',
    date: '2025-04-30',
    time: '09:00',
    description: '',
    status: 'scheduled'
  }
];

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

interface MeetingsScreenProps {
  isLoggedIn: boolean;
  currentUser: UserType | null;
}

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
  const [meetings, setMeetings] = useState<Meeting[]>(mockMeetings);
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
  const [meetingDialogOpen, setMeetingDialogOpen] = useState(false);
  const [isEditingMeeting, setIsEditingMeeting] = useState(false);
  
  // Inbox state
  const [inboxMessages, setInboxMessages] = useState<InboxMessage[]>([]);
  const [inboxDialogOpen, setInboxDialogOpen] = useState(false);
  const [isLoadingInbox, setIsLoadingInbox] = useState(false);
  const [isSubmittingMessage, setIsSubmittingMessage] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  
  // Simplified Meeting Form state
  const [meetingFormData, setMeetingFormData] = useState({
    date: '',
    time: ''
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
  
  // Load inbox messages from the API
  const loadInboxMessages = async () => {
    if (!isLoadingInbox && isLoggedIn) {
      setIsLoadingInbox(true);
      try {
        const messages = await getInboxMessages();
        setInboxMessages(messages);
      } catch (error) {
        console.error('Error loading inbox messages:', error);
      } finally {
        setIsLoadingInbox(false);
      }
    }
  };
  
  // Handle tab change
  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  // Meeting functions
  const handleOpenMeetingDialog = (meeting?: Meeting) => {
    if (meeting) {
      setSelectedMeeting(meeting);
      setMeetingFormData({
        date: meeting.date,
        time: meeting.time
      });
      setIsEditingMeeting(true);
    } else {
      setSelectedMeeting(null);
      setMeetingFormData({
        date: getTodayDate(),
        time: '10:00'
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
        [name]: value
      });
    }
  };
  
  const handleSaveMeeting = () => {
    // Validate form data
    if (!meetingFormData.date || !meetingFormData.time) {
      return;
    }
    
    if (isEditingMeeting && selectedMeeting) {
      // Update existing meeting
      const updatedMeetings = meetings.map(meeting => 
        meeting.id === selectedMeeting.id 
          ? { 
              ...meeting, 
              date: meetingFormData.date,
              time: meetingFormData.time
            }
          : meeting
      );
      setMeetings(updatedMeetings);
    } else {
      // Create new meeting with a temp ID
      const newId = Date.now().toString();
      const newMeeting: Meeting = {
        id: newId,
        title: 'Basmöte', // Fixed title
        date: meetingFormData.date,
        time: meetingFormData.time,
        description: '', // Empty description
        status: 'scheduled' // Default status
      };
      setMeetings([...meetings, newMeeting]);
    }
    
    handleCloseMeetingDialog();
  };
  
  const handleDeleteMeeting = (id: string) => {
    // Delete meeting
    setMeetings(meetings.filter(meeting => meeting.id !== id));
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
        [name]: value
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
      }
    } catch (error) {
      console.error('Error submitting message:', error);
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
      }
    } catch (error) {
      console.error('Error marking message as read:', error);
    }
  };
  
  // Delete a message
  const handleDeleteMessage = async (id: string) => {
    try {
      const success = await deleteInboxMessage(id);
      if (success) {
        // Remove message from state
        setInboxMessages(inboxMessages.filter(message => message.id !== id));
      }
    } catch (error) {
      console.error('Error deleting message:', error);
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
    return `${day}/${month}/${year}`;
  };
  
  // Helper to convert time string to Date object
  const timeStringToDate = (timeStr: string): Date => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    const date = new Date();
    date.setHours(hours);
    date.setMinutes(minutes);
    date.setSeconds(0);
    return date;
  };
  
  // Render the meetings tab content
  const renderMeetingsTab = () => {
    return (
      <Box sx={{ position: 'relative', minHeight: '400px' }}>
        {/* Header with add button for logged in users */}
        {isLoggedIn && !isMobile && (
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
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
        
        {/* Custom meeting list for all users */}
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
                
                // Create a Date object for the clock
                const meetingTime = timeStringToDate(meeting.time);
                
                // Responsive layout based on screen size
                return (
                  <React.Fragment key={meeting.id}>
                    {index > 0 && <Divider />}
                    
                    {/* Mobile layout - Updated with requested order: Icon, Title, Day card, Clock */}
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
                        {/* Calendar Mulberry Symbol Icon */}
                        <Box 
                          component="div"
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flex: '0 0 auto'
                          }}
                        >
                          <CalendarIcon size={36} color="#1976D2" />
                        </Box>
                        
                        {/* Meeting Title */}
                        <Box sx={{ 
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          flex: '1 1 auto'
                        }}>
                          <Typography variant="h6" fontWeight="medium" noWrap sx={{ mr: 1, maxWidth: '110px' }}>
                            {meeting.title}
                          </Typography>
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
                        
                        {/* Clock and time */}
                        <Box sx={{ 
                          display: 'flex', 
                          flexDirection: 'column',
                          alignItems: 'center',
                          flex: '0 0 auto'
                        }}>
                          <Clock 
                            value={meetingTime}
                            size={65}
                            renderNumbers={false}
                            hourHandWidth={2.5}
                            minuteHandWidth={1.5}
                            renderSecondHand={false}
                            hourMarksLength={8}
                            hourMarksWidth={1.5}
                            minuteMarksLength={3}
                            minuteMarksWidth={0.5}
                            renderHourMarks
                            renderMinuteMarks={false}
                            hourHandLength={30}
                            minuteHandLength={45}
                          />
                          <Typography variant="caption" fontWeight="medium" sx={{ mt: 0.5 }}>
                            {meeting.time}
                          </Typography>
                        </Box>
                        
                        {/* Delete icon only for logged in users */}
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
                      /* Desktop layout - with consistent color styling */
                      <ListItem 
                        sx={{ 
                          py: 3,
                          px: 3,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 2.5
                        }}
                      >
                        {/* Calendar Mulberry Symbol Icon */}
                        <Box 
                          component="div"
                          sx={{
                            minWidth: 70,
                            minHeight: 70,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flex: '0 0 auto'
                          }}
                        >
                          <CalendarIcon size={56} color="#1976D2" />
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
                        
                        {/* Meeting title */}
                        <Box sx={{ 
                          flexGrow: 1,
                          display: 'flex',
                          alignItems: 'center'
                        }}>
                          <Typography variant="h5" fontWeight="medium">
                            {meeting.title}
                          </Typography>
                        </Box>
                        
                        {/* Time with Clock */}
                        <Box sx={{ 
                          display: 'flex', 
                          flexDirection: 'column', 
                          alignItems: 'center',
                          flex: '0 0 auto'
                        }}>
                          <Clock 
                            value={meetingTime}
                            size={100}
                            renderNumbers={true}
                            hourHandWidth={3}
                            minuteHandWidth={2}
                            renderSecondHand={false}
                            hourMarksLength={10}
                            hourMarksWidth={2}
                            minuteMarksLength={5}
                            minuteMarksWidth={1}
                            renderHourMarks
                            renderMinuteMarks={false}
                            hourHandLength={50}
                            minuteHandLength={70}
                          />
                          
                          <Typography variant="body2" fontWeight="medium" sx={{ mt: 1 }}>
                            {meeting.time}
                          </Typography>
                        </Box>
                        
                        {/* Delete icon only for logged in users */}
                        {isLoggedIn && (
                          <IconButton 
                            edge="end" 
                            color="error" 
                            onClick={() => handleDeleteMeeting(meeting.id)}
                            sx={{ ml: 1 }}
                          >
                            <Trash size={20} />
                          </IconButton>
                        )}
                      </ListItem>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </List>
        </Paper>
        
        {/* Floating Action Button for mobile */}
        {isLoggedIn && isMobile && (
          <Fab 
            color="primary" 
            size="medium"
            sx={{ position: 'fixed', bottom: 16, right: 16 }}
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
      {/* Additional CSS for the transparent clock styling */}
      <style>
        {`
          .react-clock__face {
            border: none !important;
            background: transparent !important;
          }
          .react-clock {
            background: transparent !important;
          }
        `}
      </style>
      
      {/* Header with current day and clock - ADDED FROM STATUSSCREEN */}
      <Box sx={{ textAlign: 'center', mb: isMobile ? 2 : 3 }}>
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          gap: isMobile ? 2 : 4, 
          mb: isMobile ? 1.5 : 3,
          flexDirection: isMobile ? 'column' : 'row'
        }}>
          {/* Day widget with consistent color styling */}
          <Paper 
            elevation={2} 
            sx={{ 
              px: isMobile ? 2 : 3, 
              py: isMobile ? 1 : 1.5, 
              borderRadius: 2,
              bgcolor: currentDayColor, // Using the same color variable calculation
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: isMobile ? 'auto' : 150,
              width: isMobile ? '80%' : 'auto'
            }}
          >
            <Typography 
              variant={isMobile ? "h5" : "h4"} 
              sx={{ 
                fontWeight: 'bold', 
                color: 'rgba(0,0,0,0.85)', // Same text color as in meeting items
                mb: 0.5
              }}
            >
              {currentFullDayName}
            </Typography>
            <Typography 
              variant={isMobile ? "subtitle1" : "h6"} 
              sx={{ color: 'rgba(0,0,0,0.7)' }} // Same secondary text color as in meeting items
            >
              {currentDateString}
            </Typography>
          </Paper>
          
          {/* Real-time clock component */}
          {!isMobile && (
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
          )}
        </Box>
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
      
      {/* Simplified Meeting Dialog */}
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
          <Box sx={{ mt: 2 }}>
            <Box sx={{ 
              display: 'flex', 
              flexDirection: isMobile ? 'column' : 'row',
              gap: 2 
            }}>
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
              />
              
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
              />
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseMeetingDialog}>Avbryt</Button>
          <Button 
            onClick={handleSaveMeeting} 
            variant="contained"
            disabled={!meetingFormData.date || !meetingFormData.time}
          >
            Spara
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
    </Box>
  );
};

export default MeetingsScreen;
