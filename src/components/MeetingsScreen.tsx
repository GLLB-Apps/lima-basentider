import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Paper, List, ListItem, ListItemText, 
  ListItemIcon, Divider, Button, TextField, Dialog, 
  DialogTitle, DialogContent, DialogActions, Chip, Tabs, Tab,
  Fab, IconButton, CircularProgress, Badge
} from '@mui/material';
import { Plus, Edit, Trash, Gavel, Clock, Calendar as CalendarIcon, Inbox, SquareCheckBig } from 'lucide-react';
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
    title: 'Veckomöte',
    date: '2025-05-10',
    time: '13:00',
    description: 'Genomgång av veckans händelser och planering framåt.',
    status: 'scheduled'
  },
  {
    id: '2',
    title: 'Beslutskonferens',
    date: '2025-05-15',
    time: '10:00',
    description: 'Viktiga beslut om kommande projekt ska tas.',
    status: 'scheduled'
  },
  {
    id: '3',
    title: 'Budgetmöte',
    date: '2025-04-30',
    time: '09:00',
    description: 'Genomgång av kvartalets budget.',
    status: 'completed'
  }
];

interface MeetingsScreenProps {
  isLoggedIn: boolean;
  currentUser: UserType | null;
}

const MeetingsScreen: React.FC<MeetingsScreenProps> = ({ isLoggedIn, currentUser }) => {
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
  
  // Meeting Form state
  const [meetingFormData, setMeetingFormData] = useState({
    title: '',
    date: '',
    time: '',
    description: '',
    status: 'scheduled' as 'scheduled' | 'completed' | 'cancelled'
  });
  
  // Inbox Form state
  const [inboxFormData, setInboxFormData] = useState({
    title: '',
    content: ''
  });

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
        title: meeting.title,
        date: meeting.date,
        time: meeting.time,
        description: meeting.description,
        status: meeting.status
      });
      setIsEditingMeeting(true);
    } else {
      setSelectedMeeting(null);
      setMeetingFormData({
        title: '',
        date: getTodayDate(),
        time: '10:00',
        description: '',
        status: 'scheduled'
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
    if (!meetingFormData.title || !meetingFormData.date || !meetingFormData.time) {
      return;
    }
    
    if (isEditingMeeting && selectedMeeting) {
      // Update existing meeting
      const updatedMeetings = meetings.map(meeting => 
        meeting.id === selectedMeeting.id 
          ? { ...meeting, ...meetingFormData }
          : meeting
      );
      setMeetings(updatedMeetings);
    } else {
      // Create new meeting with a temp ID
      const newId = Date.now().toString();
      const newMeeting: Meeting = {
        id: newId,
        ...meetingFormData
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
  
  // Get status label in Swedish
  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'scheduled':
        return 'Planerat';
      case 'completed':
        return 'Genomfört';
      case 'cancelled':
        return 'Inställt';
      default:
        return status;
    }
  };
  
  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled':
        return 'primary';
      case 'completed':
        return 'success';
      case 'cancelled':
        return 'error';
      default:
        return 'default';
    }
  };
  
  // Render the meetings tab content
  const renderMeetingsTab = () => {
    return (
      <>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center' }}>
            <Gavel size={20} style={{ marginRight: '8px' }} />
            Möten
          </Typography>
          
          {isLoggedIn && (
            <Button 
              variant="contained" 
              startIcon={<Plus size={16} />}
              onClick={() => handleOpenMeetingDialog()}
            >
              Nytt möte
            </Button>
          )}
        </Box>
        
        <Paper elevation={2}>
          <List>
            {meetings.length === 0 ? (
              <ListItem>
                <ListItemText primary="Inga möten schemalagda" />
              </ListItem>
            ) : (
              meetings.map((meeting, index) => (
                <React.Fragment key={meeting.id}>
                  {index > 0 && <Divider />}
                  <ListItem 
                    secondaryAction={
                      isLoggedIn && (
                        <Box>
                          <Button startIcon={<Edit size={16} />} onClick={() => handleOpenMeetingDialog(meeting)}>
                            Redigera
                          </Button>
                          <Button color="error" startIcon={<Trash size={16} />} onClick={() => handleDeleteMeeting(meeting.id)}>
                            Ta bort
                          </Button>
                        </Box>
                      )
                    }
                  >
                    <ListItemIcon>
                      <CalendarIcon size={24} />
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <Typography variant="subtitle1" sx={{ mr: 1 }}>
                            {meeting.title}
                          </Typography>
                          <Chip 
                            label={getStatusLabel(meeting.status)} 
                            color={getStatusColor(meeting.status) as any}
                            size="small"
                          />
                        </Box>
                      }
                      secondary={
                        <>
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <Typography variant="body2" sx={{ mr: 2 }}>
                              {formatDate(meeting.date)}
                            </Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                              <Clock size={14} style={{ marginRight: '4px' }} />
                              <Typography variant="body2">
                                {meeting.time}
                              </Typography>
                            </Box>
                          </Box>
                          <Typography variant="body2" color="text.secondary">
                            {meeting.description}
                          </Typography>
                        </>
                      }
                    />
                  </ListItem>
                </React.Fragment>
              ))
            )}
          </List>
        </Paper>
      </>
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
          
          <Button 
            variant="outlined"
            onClick={loadInboxMessages}
            disabled={isLoadingInbox}
            startIcon={isLoadingInbox ? <CircularProgress size={16} /> : null}
          >
            {isLoadingInbox ? 'Uppdaterar...' : 'Uppdatera'}
          </Button>
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
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 3 }}>
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
                      mb: 1
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
                    >
                      Ta bort
                    </Button>
                  ) : (
                    <>
                      <Button 
                        sx={{ mr: 1 }}
                        onClick={() => handleMarkAsRead(message.id)}
                        startIcon ={<SquareCheckBig size={16} />}
                      >
                        Markera som läst
                      </Button>
                      <Button 
                        startIcon={<Trash size={16} />} 
                        color="error"
                        onClick={() => handleDeleteMessage(message.id)}
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
      </>
    );
  };
  
  return (
    <Box sx={{ p: 2 }}>
      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
        <Tabs value={activeTab} onChange={handleTabChange} aria-label="module tabs">
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
                      right: +10,
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
      
      {/* Meeting Dialog */}
      <Dialog open={meetingDialogOpen} onClose={handleCloseMeetingDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {isEditingMeeting ? 'Redigera möte' : 'Nytt möte'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 1 }}>
            <TextField
              label="Titel"
              name="title"
              value={meetingFormData.title}
              onChange={handleMeetingInputChange}
              fullWidth
              margin="normal"
              required
            />
            
            <Box sx={{ display: 'flex', gap: 2, my: 2 }}>
              <TextField
                label="Datum"
                name="date"
                type="date"
                value={meetingFormData.date}
                onChange={handleMeetingInputChange}
                fullWidth
                InputLabelProps={{ shrink: true }}
                required
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
              />
            </Box>
            
            <TextField
              label="Beskrivning"
              name="description"
              value={meetingFormData.description}
              onChange={handleMeetingInputChange}
              fullWidth
              margin="normal"
              multiline
              rows={3}
            />
            
            <TextField
              select
              label="Status"
              name="status"
              value={meetingFormData.status}
              onChange={handleMeetingInputChange}
              fullWidth
              margin="normal"
              SelectProps={{
                native: true
              }}
            >
              <option value="scheduled">Planerat</option>
              <option value="completed">Genomfört</option>
              <option value="cancelled">Inställt</option>
            </TextField>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseMeetingDialog}>Avbryt</Button>
          <Button onClick={handleSaveMeeting} variant="contained">
            Spara
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Inbox Dialog */}
      <Dialog open={inboxDialogOpen} onClose={handleCloseInboxDialog} maxWidth="sm" fullWidth>
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
            margin="normal"
            required
            disabled={isSubmittingMessage}
            placeholder="Vad gäller ditt meddelande?"
          />
          
          <TextField
            label="Meddelande"
            name="content"
            value={inboxFormData.content}
            onChange={handleInboxInputChange}
            fullWidth
            margin="normal"
            multiline
            rows={6}
            required
            disabled={isSubmittingMessage}
            placeholder="Skriv ditt meddelande här..."
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