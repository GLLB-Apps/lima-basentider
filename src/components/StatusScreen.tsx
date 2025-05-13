import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Container,
  Typography,
  Paper,
  Card,
  CardContent,
  Divider,
  LinearProgress,
  Badge,
  Tooltip
} from '@mui/material';
import Clock from 'react-clock';
import 'react-clock/dist/Clock.css'; // Import the styles
import { DaySchedule, NextOpening, Meeting } from '../types';
import { timeToMinutes } from '../utils';
import { dayColors } from '../data'; // Make sure this import is at the top
import ClockDayCard from '../components/ClockDayCard'; // Import our new combined component
import { getAllMeetings } from '../services/appwriteService';

interface Symbol {
  id: string;
  name: string;
  image_url: string;
  svg?: string;
}

type StatusScreenProps = {
  currentDay: string;
  currentTime?: string;
  currentTimeMinutes?: number;
  nextOpening: NextOpening;
  scheduleData: DaySchedule[];
  openSymbol: Symbol | null;
  closedSymbol: Symbol | null;
  awaySymbol?: Symbol | null; 
  openSymbolMessage?: string;
  closedSymbolMessage?: string;
  awaySymbolMessage?: string;
  manualOverride?: boolean;
  overrideMessage?: string;
  isCurrentlyOpen?: boolean;
  meetings?: Meeting[]; // Add meetings array prop
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

// Helper to get today's date in YYYY-MM-DD format for meeting comparison
const getTodayDateString = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Helper function to ensure we have a color with proper opacity
const getProperDayColor = (day: string, scheduleData: any[]): string => {
  const daySchedule = scheduleData.find(d => d.day === day);
  let baseColor = null;
  
  // Try to get color from schedule data first
  if (daySchedule && daySchedule.color) {
    baseColor = daySchedule.color;
  } 
  // Then try default day colors
  else if (dayColors && dayColors[day]) {
    baseColor = dayColors[day];
  }
  
  // If no color found, use default
  if (!baseColor) {
    return 'rgba(25, 118, 210, 0.5)';
  }
  
  // Make sure the color has opacity
  if (baseColor.startsWith('#')) {
    return baseColor + '88'; // Add 50% opacity in hex format
  } else if (baseColor.startsWith('rgb') && !baseColor.startsWith('rgba')) {
    return baseColor.replace('rgb', 'rgba').replace(')', ', 0.5)');
  }
  
  return baseColor;
};

// Helper function to check if two dates are the same day
const isSameDay = (date1: Date, date2: Date): boolean => {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
};

const StatusScreen = ({
  currentDay,
  currentTime,
  currentTimeMinutes,
  nextOpening,
  scheduleData,
  openSymbol,
  closedSymbol,
  awaySymbol = null,
  openSymbolMessage = "Vi har öppet",
  closedSymbolMessage = "Vi har stängt",
  awaySymbolMessage = "Borta för tillfället",
  manualOverride = false,
  overrideMessage = "",
  meetings = []
}: StatusScreenProps) => {
  // Create a separate state for the clock that updates every second
  const [clockTime, setClockTime] = useState(new Date());
  
  // State for business hours
  const [now, setNow] = useState(new Date());
  const displayTime = currentTime || now.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
  const timeInMinutes = currentTimeMinutes || (now.getHours() * 60 + now.getMinutes());
  
  // State for meetings
  const [localMeetings, setLocalMeetings] = useState<Meeting[]>(meetings);
  const [isLoadingMeetings, setIsLoadingMeetings] = useState(false);
  
  // Get the current full date string
  const currentDateString = useMemo(() => getCurrentDateString(), []);
  const todayDateString = useMemo(() => getTodayDateString(), []);
  
  // Check if meeting is today
  const checkIfMeetingIsToday = (meeting: Meeting): boolean => {
    try {
      if (typeof meeting.date === 'string') {
        if (meeting.date === todayDateString) {
          return true;
        }
        
        // Try comparing as date objects if string comparison fails
        let meetingDate: Date;
        if (meeting.date.includes('-')) {
          // YYYY-MM-DD format
          const [year, month, day] = meeting.date.split('-').map(Number);
          meetingDate = new Date(year, month - 1, day);
        } else if (meeting.date.includes('/')) {
          // MM/DD/YYYY format
          const [month, day, year] = meeting.date.split('/').map(Number);
          meetingDate = new Date(year, month - 1, day);
        } else {
          // Try direct parsing
          meetingDate = new Date(meeting.date);
        }
        
        // Check if valid date and is today
        if (!isNaN(meetingDate.getTime())) {
          return isSameDay(new Date(), meetingDate);
        }
      } else if (meeting.date && typeof meeting.date === 'object' && 'getTime' in meeting.date) {
        // If it's a Date object (checking for getTime method)
        return isSameDay(new Date(), meeting.date);
      } else if (meeting.date) {
        // Last resort - try to parse whatever it is
        const parsedDate = new Date(meeting.date as any);
        if (!isNaN(parsedDate.getTime())) {
          return isSameDay(new Date(), parsedDate);
        }
      }
    } catch (error) {
      console.error('Error checking if meeting is today:', error, meeting);
    }
    
    return false;
  };
  
  // Detect meetings for today
  const findMeetingsForToday = (meetingsToCheck: Meeting[]): { hasMeetingToday: boolean, todaysMeeting: Meeting | null } => {
    for (const meeting of meetingsToCheck) {
      if (checkIfMeetingIsToday(meeting)) {
        console.log('Found meeting today:', meeting);
        return { hasMeetingToday: true, todaysMeeting: meeting };
      }
    }
    return { hasMeetingToday: false, todaysMeeting: null };
  };

  // State for meeting detection
  const [hasMeetingToday, setHasMeetingToday] = useState(false);
  const [todaysMeeting, setTodaysMeeting] = useState<Meeting | null>(null);

  // Function to update meeting status - will be called every minute
  const updateMeetingStatus = async (forceRefresh = false) => {
    console.log('Checking for meetings today...');
    const meetingsToCheck = meetings.length > 0 ? meetings : localMeetings;
    
    // If we need to refresh meetings from the server or if we don't have any
    if (forceRefresh || meetingsToCheck.length === 0) {
      setIsLoadingMeetings(true);
      try {
        const fetchedMeetings = await getAllMeetings();
        console.log('Fetched meetings:', fetchedMeetings);
        setLocalMeetings(fetchedMeetings);
        
        // Check the newly fetched meetings
        const { hasMeetingToday: hasNewMeeting, todaysMeeting: newMeeting } = findMeetingsForToday(fetchedMeetings);
        setHasMeetingToday(hasNewMeeting);
        setTodaysMeeting(newMeeting);
      } catch (error) {
        console.error('Error loading meetings:', error);
      } finally {
        setIsLoadingMeetings(false);
      }
    } else {
      // Use existing meetings
      const { hasMeetingToday: hasExistingMeeting, todaysMeeting: existingMeeting } = findMeetingsForToday(meetingsToCheck);
      setHasMeetingToday(hasExistingMeeting);
      setTodaysMeeting(existingMeeting);
    }
  };
  
  // Initial check when component mounts
  useEffect(() => {
    updateMeetingStatus(true); // Force refresh on first load
  }, [meetings]);
  
  // Set up periodic check for meetings (every minute)
  useEffect(() => {
    // Update meeting check with business logic time
    const meetingCheckInterval = setInterval(() => {
      updateMeetingStatus(); // Regular check every minute (uses cache)
    }, 60000);
    
    // Also set up a daily refresh at midnight
    const scheduleMidnightRefresh = () => {
      const now = new Date();
      const midnight = new Date(now);
      midnight.setHours(24, 0, 0, 0);
      
      const timeToMidnight = midnight.getTime() - now.getTime();
      
      // Set timeout for midnight refresh
      const midnightTimeout = setTimeout(() => {
        console.log('Midnight refresh of meetings');
        updateMeetingStatus(true); // Force refresh at midnight
        scheduleMidnightRefresh(); // Schedule next day's refresh
      }, timeToMidnight);
      
      return midnightTimeout;
    };
    
    const midnightTimeout = scheduleMidnightRefresh();
    
    return () => {
      clearInterval(meetingCheckInterval);
      clearTimeout(midnightTimeout);
    };
  }, []);
  
  // Get full day name
  const fullDayName = useMemo(() => fullDayNames[currentDay] || currentDay, [currentDay]);

  // Get color for the current day (with opacity)
  const dayColor = useMemo(() => 
    getProperDayColor(currentDay, scheduleData),
    [currentDay, scheduleData]
  );

  // Get color for the next opening day (with opacity)
  const nextDayColor = useMemo(() => 
    getProperDayColor(nextOpening.day, scheduleData),
    [nextOpening.day, scheduleData]
  );
  
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
  
  // Find the current day's schedule
  const currentDaySchedule = useMemo(() => {
    return scheduleData.find(day => day.day === currentDay);
  }, [scheduleData, currentDay]);
  
  // Check if we have a current time slot - use useMemo to recalculate when dependencies change
  const currentTimeSlot = useMemo(() => {
    // Always check away mode first
    if (manualOverride) {
      console.log("Away mode is active, ignoring schedule");
      return null;
    }
    
    return currentDaySchedule?.times.find(
      time => timeInMinutes >= timeToMinutes(time.start) && timeInMinutes < timeToMinutes(time.end)
    );
  }, [currentDaySchedule, timeInMinutes, manualOverride]);
  
  // Determine if the place is currently open (respecting manual override)
  const isOpen = useMemo(() => {
    // Always check away mode first
    if (manualOverride) {
      return false;
    }
    return Boolean(currentTimeSlot);
  }, [manualOverride, currentTimeSlot]);
  
  // State for progress calculation - when closed
  const [progressPercent, setProgressPercent] = useState(0);
  const [timeUntilOpenText, setTimeUntilOpenText] = useState('');
  
  // State for progress calculation - when open
  const [closeProgressPercent, setCloseProgressPercent] = useState(0);
  const [timeUntilCloseText, setTimeUntilCloseText] = useState('');

  // Constants for progress calculations
  const HOURS_24 = 24 * 60; // 24 hours in minutes
  
  // Calculate progress towards next opening time - Always use 24 hours as the basis
  useEffect(() => {
    if (!manualOverride && !isOpen && nextOpening.minutesUntil > 0) {
      // Change from 24 hours to 12 hours (720 minutes) as the denominator
      const HOURS_12 = 12 * 60; // 12 hours in minutes
      
      // Calculate what percentage of a 12-hour period has passed
      const currentTimeInCycle = timeInMinutes % HOURS_12;
      const percentOfCycle = (currentTimeInCycle / HOURS_12) * 100;
      
      // Calculate when in the 12-hour cycle we'll open
      let openingTimeMinutes;
      if (nextOpening.day === currentDay) {
        // Opening is today, use the actual opening time
        openingTimeMinutes = timeToMinutes(nextOpening.time) % HOURS_12;
      } else {
        // Opening is tomorrow or later
        openingTimeMinutes = (timeToMinutes(nextOpening.time) + HOURS_12) % HOURS_12;
      }
      
      // Calculate the percentage of the cycle at which opening occurs
      const openingPercentage = (openingTimeMinutes / HOURS_12) * 100;
      
      // Calculate progress percentage
      let percent;
      if (openingPercentage >= percentOfCycle) {
        // Normal case: opening time is later in the cycle
        percent = (percentOfCycle / openingPercentage) * 100;
      } else {
        // Opening is in the next cycle
        percent = (percentOfCycle / (100 + openingPercentage)) * 100;
      }
      
      // Ensure percent is always between 0-100
      percent = Math.max(0, Math.min(100, percent));
      setProgressPercent(percent);
      
      // Format time until open text
      const hours = Math.floor(nextOpening.minutesUntil / 60);
      const minutes = nextOpening.minutesUntil % 60;
      
      if (hours > 0) {
        setTimeUntilOpenText(`${hours} timmar ${minutes} minuter till öppning`);
      } else {
        setTimeUntilOpenText(`${minutes} minuter till öppning`);
      }
    } else {
      setProgressPercent(0);
      setTimeUntilOpenText('');
    }
  }, [manualOverride, isOpen, nextOpening, timeInMinutes, currentDay]);
  
  // Calculate progress towards closing time - Always use 24 hours as the basis
  useEffect(() => {
    if (!manualOverride && isOpen && currentTimeSlot) {
      // For consistency, always use 24 hours (1440 minutes) as the denominator
      // This makes the progress bar represent "time of day" rather than specific duration
      
      const startMinutes = timeToMinutes(currentTimeSlot.start);
      const endMinutes = timeToMinutes(currentTimeSlot.end);
      
      // Calculate percentages within a 24-hour day
      const startPercentage = (startMinutes / HOURS_24) * 100;
      const endPercentage = (endMinutes / HOURS_24) * 100;
      const currentPercentage = (timeInMinutes / HOURS_24) * 100;
      
      // Calculate progress through the open period
      let percent = 0;
      if (endPercentage > startPercentage) {
        // Normal case (e.g., open 9am-5pm)
        percent = ((currentPercentage - startPercentage) / (endPercentage - startPercentage)) * 100;
      } else {
        // Overnight case (e.g., open 10pm-6am)
        // We need to handle wrapping around midnight
        if (currentPercentage >= startPercentage) {
          // After start time but before midnight
          percent = ((currentPercentage - startPercentage) / (100 - startPercentage + endPercentage)) * 100;
        } else {
          // After midnight but before end time
          percent = ((100 - startPercentage + currentPercentage) / (100 - startPercentage + endPercentage)) * 100;
        }
      }
      
      // Ensure percent is always between 0-100
      percent = Math.max(0, Math.min(100, percent));
      setCloseProgressPercent(percent);
      
      // How much time until closing
      const minutesUntilClose = endMinutes > timeInMinutes 
        ? endMinutes - timeInMinutes 
        : (24 * 60) - timeInMinutes + endMinutes; // Handle overnight
      
      // Format time until close text
      const hours = Math.floor(minutesUntilClose / 60);
      const minutes = minutesUntilClose % 60;
      
      if (hours > 0) {
        setTimeUntilCloseText(`${hours} timmar ${minutes} minuter till stängning`);
      } else {
        setTimeUntilCloseText(`${minutes} minuter till stängning`);
      }
    } else {
      setCloseProgressPercent(0);
      setTimeUntilCloseText('');
    }
  }, [manualOverride, isOpen, currentTimeSlot, timeInMinutes]);
  
  // Get status message based on open/closed/away status - use useMemo for reactive updates
  const statusMessage = useMemo(() => {
    if (manualOverride) {
      console.log('Using override/away message:', overrideMessage || awaySymbolMessage);
      return overrideMessage || awaySymbolMessage;
    }
    console.log('Using open/closed message:', isOpen ? openSymbolMessage : closedSymbolMessage);
    return isOpen ? openSymbolMessage : closedSymbolMessage;
  }, [manualOverride, isOpen, overrideMessage, awaySymbolMessage, openSymbolMessage, closedSymbolMessage]);

  // Get status color - now includes away mode (orange) - use useMemo for reactive updates
  const statusColor = useMemo(() => {
    if (manualOverride) {
      return {
        main: 'warning.main', // Orange for away mode
        bg: 'rgba(255, 152, 0, 0.05)',
        border: 'rgba(255, 152, 0, 0.2)'
      };
    }
    
    return isOpen 
      ? { main: 'success.main', bg: 'rgba(0, 255, 8, 0.05)', border: 'rgba(0, 200, 0, 0.2)' }
      : { main: 'error.main', bg: 'rgba(255, 0, 0, 0.05)', border: 'rgba(200, 0, 0, 0.2)' };
  }, [manualOverride, isOpen]);

  // Get current symbol based on status - use useMemo for reactive updates
  const currentSymbol = useMemo(() => {
    if (manualOverride) {
      console.log('Using away symbol:', awaySymbol);
      return awaySymbol;
    }
    console.log('Using open/closed symbol:', isOpen ? openSymbol : closedSymbol);
    return isOpen ? openSymbol : closedSymbol;
  }, [manualOverride, isOpen, awaySymbol, openSymbol, closedSymbol]);

  // Get status label - use useMemo for reactive updates
  const statusLabel = useMemo(() => {
    if (manualOverride) return 'BORTA';
    return isOpen ? 'ÖPPET' : 'STÄNGT';
  }, [manualOverride, isOpen]);

  // Create a stable key that only changes when the symbol actually changes
  const symbolKey = useMemo(() => {
    return currentSymbol ? `${currentSymbol.id}-${currentSymbol.image_url}` : 'no-symbol';
  }, [currentSymbol]);

  // Helper function to create a Date with specific time
  const createDateWithTime = (timeString: string): Date => {
    const [hours, minutes] = timeString.split(':').map(num => parseInt(num, 10));
    const dateWithTime = new Date();
    dateWithTime.setHours(hours || 0);
    dateWithTime.setMinutes(minutes || 0);
    dateWithTime.setSeconds(0);
    return dateWithTime;
  };

  // Calendar icon URL - this is a basic example, replace with your actual icon
  const calendarIconUrl = "data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22850.394%22%20height%3D%22850.394%22%20viewBox%3D%220%200%20850.394%20850.394%22%20overflow%3D%22visible%22%3E%3Cpath%20fill%3D%22%23ff001c%22%20d%3D%22M696.88%20111.76v119.33h-.22v-.44H154.9V111.76z%22%2F%3E%3Cpath%20fill%3D%22%23fff%22%20d%3D%22M561.22%20636.97h135.44v135.44H561.22zM561.22%20501.53h135.44v135.439H561.22zM561.22%20366.09h135.44v135.44H561.22z%22%2F%3E%3Cpath%20fill%3D%22%23fff%22%20d%3D%22M561.22%20231.09h135.44v135H561.22zM425.78%20636.97h135.44v135.44H425.78zM425.78%20501.53h135.44v135.439H425.78zM425.78%20366.09h135.44v135.44H425.78z%22%2F%3E%3Cpath%20fill%3D%22%23fff%22%20d%3D%22M425.78%20231.09h135.44v135H425.78zM290.34%20636.97h135.44v135.44H290.34zM290.34%20501.53h135.44v135.439H290.34zM290.34%20366.09h135.44v135.44H290.34z%22%2F%3E%3Cpath%20fill%3D%22%23fff%22%20d%3D%22M290.34%20231.09h135.44v135H290.34zM154.9%20636.97h135.44v135.44H154.9zM154.9%20501.53h135.44v135.439H154.9z%22%2F%3E%3Cpath%20fill%3D%22%23fff%22%20d%3D%22M154.9%20366.09h135.44v135.44H154.9z%22%2F%3E%3Cpath%20fill%3D%22%23fff%22%20d%3D%22M154.9%20231.09h135.44v135H154.9z%22%2F%3E%3Cg%20fill%3D%22none%22%20stroke%3D%22%23231f20%22%3E%3Cpath%20stroke-width%3D%2221%22%20d%3D%22M154.9%20230.65h541.76v541.76H154.9V231.09M154.9%20636.97h541.76M154.9%20501.53h541.76M154.9%20366.09h541.76M561.22%20230.65v541.76M425.78%20230.65v541.76M290.34%20230.65v541.76%22%2F%3E%3Cpath%20stroke-width%3D%2221%22%20d%3D%22M154.9%20230.65V111.76h541.98v119.33H154.9z%22%2F%3E%3Cpath%20stroke-width%3D%2227.872%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%20d%3D%22M176.79%2082.73v21.22M225.56%2082.73v21.22M275.5%2082.82v21.21M324.27%2082.98v21.21M374.21%2083.31v21.21M425.78%2083.46v21.21M474.56%2083.46v21.21M524.49%2083.54v21.21M573.26%2083.71v21.21M623.2%2084.04v21.21M675.32%2082.83v21.21%22%2F%3E%3C%2Fg%3E%3Cpath%20fill%3D%22none%22%20d%3D%22M0%200h850.394v850.394H0z%22%2F%3E%3C%2Fsvg%3E";

  return (
    <Container maxWidth="md" sx={{ mt: 4, mb: 8 }}>
      <Box sx={{ textAlign: 'center', mb: 2 }}>
        {/* KEEP: Top ClockDayCard component */}
        <ClockDayCard 
          time={clockTime}
          day={currentDay}
          date={currentDateString}
          dayCardColor={dayColor} // Pass the explicit color
          clockSize={140}
          clockContainerSize={160}
          dayCardMinWidth={150}
          gap={4}
          containerStyles={{ mb: 3, justifyContent: 'center' }}
          clockContainerStyles={{ boxShadow: 3 }}
        />
      </Box>

      <Paper 
        elevation={5} 
        sx={{ 
          p: 3.5, 
          textAlign: 'center',
          backgroundColor: statusColor.bg,
          borderRadius: 5,
        }}
      >
        {/* Status circle - perfect balance size */}
        <Box 
          sx={{ 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center',
            mb: 2.5 
          }}
        >
          <Box 
            sx={{ 
              width: 300,
              height: 300,
              borderRadius: '50%',
              backgroundColor: statusColor.main,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              mb: 0,
              border: '7px solid',
              borderColor: statusColor.border,
              boxShadow: 3
            }}
          >
            {/* Show the appropriate symbol */}
            <>
              <Typography
                variant="h1"
                sx={{
                  color: '#fff',
                  fontWeight: 'bold',
                  fontSize: '4.4rem',
                  textShadow: '0 2px 8px rgba(0,0,0,0.25)',
                  letterSpacing: 2,
                  textTransform: 'uppercase'
                }}
              >
                {statusLabel}
              </Typography>
            </>
          </Box>
        </Box>

        {/* Symbol Card - optimally balanced size */}
        <Card 
          elevation={2} 
          sx={{ 
            mb: 2.0,
            maxWidth: 540, // Increased width to accommodate calendar icon
            maxHeight: 150, 
            mx: 'auto',
            backgroundColor: statusColor.bg,
            border: '1px solid',
            borderColor: statusColor.border,
          }}
        >
          <CardContent sx={{ 
            display: 'flex', 
            flexDirection: 'row', 
            alignItems: 'center',
            justifyContent: 'space-between',
            py: 2.25,
            px: 3.25
          }}>
            {/* Status Symbol */}
            <Box sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              minHeight: 70,
              flex: '0 0 auto',
              mr: 2
            }}>
              {currentSymbol ? (
                <Box 
                  component="img" 
                  src={currentSymbol.image_url}
                  alt={manualOverride ? "Away Symbol" : (isOpen ? "Open Symbol" : "Closed Symbol")} 
                  sx={{ height: 115, maxWidth: 115 }} 
                  key={symbolKey}
                />
              ) : (
                <Typography variant="body2" sx={{ color: 'text.secondary', fontStyle: 'italic' }}>
                  Ingen symbol
                </Typography>
              )}
              </Box>
            
            <Divider orientation="vertical" flexItem sx={{ mx: 1.75 }} />
            
            {/* Status Message */}
            <Typography variant="h5" sx={{ flex: 1, textAlign: 'left', ml: 2.25, fontSize: '1.4rem' }}>
              {statusMessage}
            </Typography>
            
            {/* Add calendar icon if there's a meeting today */}
            {hasMeetingToday && (
              <>
                <Divider orientation="vertical" flexItem sx={{ mx: 1.75 }} />
                <Box sx={{ 
                  display: 'flex', 
                  flexDirection: 'column',
                  alignItems: 'center', 
                  ml: 2,
                  minWidth: 100
                }}>
                  {/* Meeting icon with badge */}
                  <Badge 
                    color="primary" 
                    badgeContent=" " 
                    variant="dot" 
                    overlap="circular"
                    anchorOrigin={{
                      vertical: 'top',
                      horizontal: 'right',
                    }}
                    sx={{ 
                      '& .MuiBadge-badge': {
                        width: 14,
                        height: 14,
                        borderRadius: '50%'
                      },
                      mb: 1
                    }}
                  >
                    <Box 
                      component="img" 
                      src={calendarIconUrl}
                      alt="Meeting Today" 
                      sx={{ 
                        height: 50, 
                        maxWidth: 50,
                        opacity: 0.9
                      }}
                    />
                  </Badge>
                  
                  {/* Meeting time clock */}
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ 
                      borderRadius: '50%', 
                      bgcolor: 'background.paper',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: 1,
                      width: 56,
                      height: 56
                    }}>
                      <Clock 
                        value={createDateWithTime(todaysMeeting?.time || '10:00')}
                        size={50}
                        renderNumbers={false}
                        hourHandWidth={2}
                        minuteHandWidth={1.5}
                        hourHandLength={12}
                        minuteHandLength={14}
                        renderSecondHand={false}
                        renderMinuteMarks={false}
                        renderHourMarks={false}
                      />
                    </Box>
                    
                    <Typography variant="caption" sx={{ fontWeight: 'medium', color: 'text.secondary' }}>
                      Basmöte
                    </Typography>
                  </Box>
                </Box>
              </>
            )}
          </CardContent>
        </Card>

        {/* Simple time information - optimally balanced size */}
        <Box sx={{ mb: 1 }}>
          {manualOverride ? (
            <Typography variant="h5">
              Vi är snart tillbaka
            </Typography>
          ) : isOpen && currentTimeSlot ? (
            <Typography variant="h5">
              Öppet till {currentTimeSlot.end}
            </Typography>
          ) : nextOpening.day && nextOpening.time ? (
            <Box>
              <Typography variant="h6" sx={{ mb: 1.75, fontSize: '1.15rem' }}>
                Öppnar nästa gång:
              </Typography>
              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 3 }}>
                {/* MODIFIED: Remove daycard, keep only clock for next opening */}
                <Box sx={{ 
                  p: 2, 
                  borderRadius: '50%', 
                  bgcolor: 'background.paper',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: 2,
                  width: 140,
                  height: 140
                }}>
                  <Clock 
                    value={createDateWithTime(nextOpening.time)}
                    size={120}
                    renderNumbers={true}
                    hourHandWidth={4.5}
                    minuteHandWidth={3}
                    hourMarksLength={12}
                    hourMarksWidth={2.5}
                    minuteMarksLength={6}
                    renderMinuteMarks={false}
                    hourHandLength={55}
                    minuteHandLength={80}
                    renderSecondHand={false}
                    renderHourMarks={true}
                  />
                </Box>
                
                {/* Add text for opening day with the day's color background */}
                <Paper 
                  elevation={2} 
                  sx={{ 
                    px: 2.5, 
                    py: 1.25, 
                    borderRadius: 2,
                    bgcolor: nextDayColor, // Use the next day's color for the background
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minWidth: 130
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
                    {fullDayNames[nextOpening.day] || nextOpening.day}
                  </Typography>
                  <Typography 
                    variant="body2" 
                    sx={{ color: 'rgba(0,0,0,0.7)' }}
                  >
                    {nextOpening.time}
                  </Typography>
                </Paper>
              </Box>
            </Box>
          ) : (
            <Typography variant="body1">
              Inga kommande öppettider schemalagda
            </Typography>
          )}
        </Box>
        
        {/* Progress Bar when OPEN - optimally balanced size */}
        {isOpen && !manualOverride && currentTimeSlot && (
          <Box sx={{ mt: .5, mb: 0.75, width: '100%', maxWidth: 500, mx: 'auto' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.75 }}>
              <Typography variant="body1" sx={{ visibility: 'hidden' }}>
                {currentTimeSlot.start}
              </Typography>
              <Typography variant="body1" sx={{ fontWeight: 'medium', color: 'text.secondary' }}>
                {timeUntilCloseText}
              </Typography>
              <Typography variant="body1" sx={{ visibility: 'hidden' }}>
                {currentTimeSlot.end}
              </Typography>
            </Box>
            <LinearProgress 
              variant="determinate" 
              value={closeProgressPercent} 
              sx={{ 
                height: 35,
                borderRadius: 4,
                backgroundColor: 'rgba(0, 200, 0, 0.1)', 
                '& .MuiLinearProgress-bar': {
                  backgroundColor: 'success.main',
                  borderRadius: 4
                }
              }}
            />
            
            {/* MODIFIED: Keep analog clocks but remove daycards */}
            <Box sx={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'flex-start', 
              mt: 3,
              px: 2
            }}>
              {/* Start time clock */}
              <Box sx={{ textAlign: 'center' }}>
                <Box sx={{ 
                  p: 2, 
                  borderRadius: '50%', 
                  bgcolor: 'background.paper',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: 2,
                  width: 140,
                  height: 140,
                  mb: 1.5,
                  mx: 'auto'
                }}>
                  <Clock 
                    value={createDateWithTime(currentTimeSlot.start)}
                    size={120}
                    renderNumbers={true}
                    hourHandWidth={4.5}
                    minuteHandWidth={3}
                    hourMarksLength={12}
                    hourMarksWidth={2.5}
                    minuteMarksLength={6}
                    renderMinuteMarks={false}
                    hourHandLength={55}
                    minuteHandLength={80}
                    renderSecondHand={false}
                    renderHourMarks={true}
                  />
                </Box>
                <Typography variant="h6" sx={{ fontWeight: 'medium', fontSize: '1.1rem', mb: 1 }}>
                  Öppettid
                </Typography>
                <Typography variant="body1" sx={{ color: 'text.secondary', fontWeight: 'medium' }}>
                  {currentTimeSlot.start}
                </Typography>
              </Box>
              
              {/* End time clock */}
              <Box sx={{ textAlign: 'center' }}>
                <Box sx={{ 
                  p: 2, 
                  borderRadius: '50%', 
                  bgcolor: 'background.paper',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: 2,
                  width: 140,
                  height: 140,
                  mb: 1.5,
                  mx: 'auto'
                }}>
                  <Clock 
                    value={createDateWithTime(currentTimeSlot.end)}
                    size={120}
                    renderNumbers={true}
                    hourHandWidth={4.5}
                    minuteHandWidth={3}
                    hourMarksLength={12}
                    hourMarksWidth={2.5}
                    minuteMarksLength={6}
                    renderMinuteMarks={false}
                    hourHandLength={55}
                    minuteHandLength={80}
                    renderSecondHand={false}
                    renderHourMarks={true}
                  />
                </Box>
                <Typography variant="h6" sx={{ fontWeight: 'medium', fontSize: '1.1rem', mb: 1 }}>
                  Stängningstid
                </Typography>
                <Typography variant="body1" sx={{ color: 'text.secondary', fontWeight: 'medium' }}>
                  {currentTimeSlot.end}
                </Typography>
              </Box>
            </Box>
          </Box>
        )}
        
        {/* Progress Bar when CLOSED - optimally balanced size */}
        {!isOpen && !manualOverride && nextOpening.minutesUntil > 0 && (
          <Box sx={{ mt: 2.5, mb: 0.75, width: '100%', maxWidth: 500, mx: 'auto' }}>
            <Box sx={{ display: 'flex', justifyContent: 'center', mb: 0.75 }}>
              <Typography variant="body1" sx={{ fontWeight: 'medium', color: 'text.secondary' }}>
                {timeUntilOpenText}
              </Typography>
            </Box>
            <LinearProgress 
              variant="determinate" 
              value={progressPercent} 
              sx={{ 
                height: 35,
                borderRadius: 4,
                backgroundColor: 'rgba(200, 0, 0, 0.1)', 
                '& .MuiLinearProgress-bar': {
                  backgroundColor: 'error.main',
                  borderRadius: 4
                }
              }}
            />
          </Box>
        )}
      </Paper>
    </Container>
  );
};

export default StatusScreen;