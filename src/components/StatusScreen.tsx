import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Container,
  Typography,
  Paper,
  Card,
  CardContent,
  Divider,
  LinearProgress
} from '@mui/material';
import Clock from 'react-clock';
import 'react-clock/dist/Clock.css'; // Import the styles
import { DaySchedule, NextOpening } from '../types';
import { timeToMinutes } from '../utils';

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
  overrideMessage = ""
}: StatusScreenProps) => {
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
      // For consistency, always use 24 hours (1440 minutes) as the denominator
      // This makes the progress bar represent "time of day" rather than specific wait time
      
      // Calculate what percentage of a 24-hour day has passed
      // Example: If it's 6pm (18 hours) and we open at 6am (6 hours), we're at 75% of a 24-hour day
      const hoursOfDay = (timeInMinutes / HOURS_24) * 100;
      
      // Calculate when in the 24-hour cycle we'll open
      // If nextOpening is today, this is straightforward
      // If nextOpening is tomorrow, we need to adjust
      let openingTimePercentage = 0;
      
      if (nextOpening.day === currentDay) {
        // Opening is today, calculate as percentage of 24 hours
        const openingTimeMinutes = timeToMinutes(nextOpening.time);
        openingTimePercentage = (openingTimeMinutes / HOURS_24) * 100;
      } else {
        // Opening is tomorrow or later, use a full 24-hour cycle
        openingTimePercentage = 100;
      }
      
      // Progress is how far we've moved from last closing to next opening
      // Use modular arithmetic to handle wrap-around at 100%
      let percent = 0;
      if (openingTimePercentage > hoursOfDay) {
        // Normal case, we're before opening time
        percent = (hoursOfDay / openingTimePercentage) * 100;
      } else {
        // We're after opening time in a 24-hour cycle, but still closed
        // This means opening is tomorrow
        percent = ((hoursOfDay - openingTimePercentage) / (100 - openingTimePercentage + 100)) * 100;
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

  return (
    <Container maxWidth="md" sx={{ mt: 4, mb: 8 }}>
      <Box sx={{ textAlign: 'center', mb: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 4, mb: 3 }}>
          {/* Day widget replacing the Chip */}
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
            maxWidth: 440,
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
            
            <Typography variant="h5" sx={{ flex: 1, textAlign: 'left', ml: 2.25, fontSize: '1.4rem' }}>
              {statusMessage}
            </Typography>
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
                {/* DayCard widget for next opening day */}
                <Paper 
                  elevation={2} 
                  sx={{ 
                    px: 2.75, 
                    py: 1.25, 
                    borderRadius: 2,
                    bgcolor: (() => {
                      // Find the next opening day in schedule data
                      const daySchedule = scheduleData.find(day => day.day === nextOpening.day);
                      if (daySchedule && daySchedule.color) {
                        // Use a lighter version by applying opacity via rgba
                        if (daySchedule.color.startsWith('#')) {
                          return daySchedule.color + '88'; // 50% opacity in hex
                        } else if (daySchedule.color.startsWith('rgb')) {
                          return daySchedule.color.replace('rgb', 'rgba').replace(')', ', 0.5)');
                        }
                        return daySchedule.color;
                      }
                      return 'rgba(25, 118, 210, 0.5)'; // Fallback to a light blue
                    })(),
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
                      fontSize: '1.2rem',
                      color: 'rgba(0,0,0,0.85)'
                    }}
                  >
                    {fullDayNames[nextOpening.day] || nextOpening.day}
                  </Typography>
                </Paper>

                <Typography variant="h6" sx={{ fontWeight: 'medium' }}>kl</Typography>

                {/* Static clock for next opening time - INCREASED SIZE */}
                <Box sx={{ 
                  p: 1.5, 
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
                    value={(() => {
                      // Create a Date with the opening time
                      const [hours, minutes] = nextOpening.time.split(':').map(num => parseInt(num, 10));
                      const dateWithTime = new Date();
                      dateWithTime.setHours(hours || 0);
                      dateWithTime.setMinutes(minutes || 0);
                      dateWithTime.setSeconds(0);
                      return dateWithTime;
                    })()}
                    size={120}
                    renderNumbers={true}
                    hourHandWidth={4.5}
                    minuteHandWidth={3}
                    renderSecondHand={false}
                    hourMarksLength={12}
                    hourMarksWidth={2.5}
                    minuteMarksLength={6}
                    renderHourMarks
                    renderMinuteMarks={false}
                    hourHandLength={55}
                    minuteHandLength={80}
                  />
                </Box>
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
            
            {/* Clock representations for start and end times */}
            <Box sx={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'flex-start', 
              mt: 3,
              px: 2
            }}>
              {/* Start time clock */}
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h6" sx={{ fontWeight: 'medium', fontSize: '1.1rem', mb: 1.5 }}>
                  Öppettid
                </Typography>
                <Box sx={{ 
                  p: 1.5, 
                  borderRadius: '50%', 
                  bgcolor: 'background.paper',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: 2,
                  width: 140,
                  height: 140,
                  mb: 1.5
                }}>
                  <Clock 
                    value={(() => {
                      // Create a Date with the opening time
                      const [hours, minutes] = currentTimeSlot.start.split(':').map(num => parseInt(num, 10));
                      const dateWithTime = new Date();
                      dateWithTime.setHours(hours || 0);
                      dateWithTime.setMinutes(minutes || 0);
                      dateWithTime.setSeconds(0);
                      return dateWithTime;
                    })()}
                    size={120}
                    renderNumbers={true}
                    hourHandWidth={4.5}
                    minuteHandWidth={3}
                    renderSecondHand={false}
                    hourMarksLength={12}
                    hourMarksWidth={2.5}
                    minuteMarksLength={6}
                    renderHourMarks
                    renderMinuteMarks={false}
                    hourHandLength={55}
                    minuteHandLength={80}
                  />
                </Box>
                <Typography variant="body1" sx={{ color: 'text.secondary', fontWeight: 'medium' }}>
                  {currentTimeSlot.start}
                </Typography>
              </Box>
              
              {/* End time clock */}
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h6" sx={{ fontWeight: 'medium', fontSize: '1.1rem', mb: 1.5 }}>
                  Stängningstid
                </Typography>
                <Box sx={{ 
                  p: 1.5, 
                  borderRadius: '50%', 
                  bgcolor: 'background.paper',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: 2,
                  width: 140,
                  height: 140,
                  mb: 1.5
                }}>
                  <Clock 
                    value={(() => {
                      // Create a Date with the closing time
                      const [hours, minutes] = currentTimeSlot.end.split(':').map(num => parseInt(num, 10));
                      const dateWithTime = new Date();
                      dateWithTime.setHours(hours || 0);
                      dateWithTime.setMinutes(minutes || 0);
                      dateWithTime.setSeconds(0);
                      return dateWithTime;
                    })()}
                    size={120}
                    renderNumbers={true}
                    hourHandWidth={4.5}
                    minuteHandWidth={3}
                    renderSecondHand={false}
                    hourMarksLength={12}
                    hourMarksWidth={2.5}
                    minuteMarksLength={6}
                    renderHourMarks
                    renderMinuteMarks={false}
                    hourHandLength={55}
                    minuteHandLength={80}
                  />
                </Box>
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
              <Typography variant="h6" sx={{ fontWeight: 'medium', color: 'text.secondary', fontSize: '1.1rem' }}>
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