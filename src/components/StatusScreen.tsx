import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Typography,
  Chip,
  Paper,
  Card,
  CardContent,
  Divider,
  LinearProgress
} from '@mui/material';
import { Clock, Calendar } from 'lucide-react';
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
  awaySymbol?: Symbol | null; // Added away symbol support
  openSymbolMessage?: string;
  closedSymbolMessage?: string;
  awaySymbolMessage?: string; // Added away message support
  manualOverride?: boolean;
  overrideMessage?: string;
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
  awaySymbolMessage = "Borta för tillfället", // Default away message
  manualOverride = false,
  overrideMessage = ""
}: StatusScreenProps) => {
  // State for current time if not provided via props
  const [now, setNow] = useState(new Date());
  const displayTime = currentTime || now.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
  const timeInMinutes = currentTimeMinutes || (now.getHours() * 60 + now.getMinutes());
  
  // Find the current day's schedule
  const currentDaySchedule = scheduleData.find(day => day.day === currentDay);
  
  // Check if we have a current time slot
  const currentTimeSlot = currentDaySchedule?.times.find(
    time => timeInMinutes >= timeToMinutes(time.start) && timeInMinutes < timeToMinutes(time.end)
  );
  
  // Determine if the place is currently open (respecting manual override)
  const isOpen = manualOverride ? false : Boolean(currentTimeSlot);
  
  // State for progress calculation - when closed
  const [progressPercent, setProgressPercent] = useState(0);
  const [timeUntilOpenText, setTimeUntilOpenText] = useState('');
  
  // State for progress calculation - when open
  const [closeProgressPercent, setCloseProgressPercent] = useState(0);
  const [timeUntilCloseText, setTimeUntilCloseText] = useState('');
  
  // Update time every minute if not provided via props
  useEffect(() => {
    if (!currentTime) {
      const interval = setInterval(() => setNow(new Date()), 60000);
      return () => clearInterval(interval);
    }
  }, [currentTime]);
  
  // Calculate progress towards next opening time
  useEffect(() => {
    if (!manualOverride && !isOpen && nextOpening.minutesUntil > 0) {
      // Calculate progress percent
      // For very long waits (> 24 hours), cap the denominator to 24 hours (1440 minutes)
      const maxWaitTime = Math.min(nextOpening.minutesUntil, 1440);
      const elapsed = maxWaitTime - nextOpening.minutesUntil;
      const percent = Math.max(0, Math.min(100, (elapsed / maxWaitTime) * 100));
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
  }, [manualOverride, isOpen, nextOpening]);
  
  // Calculate progress towards closing time
  useEffect(() => {
    if (!manualOverride && isOpen && currentTimeSlot) {
      const startMinutes = timeToMinutes(currentTimeSlot.start);
      const endMinutes = timeToMinutes(currentTimeSlot.end);
      const totalOpenDuration = endMinutes - startMinutes;
      
      // How much time has elapsed since opening
      const elapsedSinceOpening = timeInMinutes - startMinutes;
      
      // How much time until closing
      const minutesUntilClose = endMinutes - timeInMinutes;
      
      // Calculate progress percent (how far we are into the open period)
      const percent = Math.max(0, Math.min(100, (elapsedSinceOpening / totalOpenDuration) * 100));
      setCloseProgressPercent(percent);
      
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
  
  // Get status message based on open/closed/away status
  const getStatusMessage = () => {
    if (manualOverride) {
      return overrideMessage || awaySymbolMessage;
    }
    return isOpen ? openSymbolMessage : closedSymbolMessage;
  };

  // Get status color - now includes away mode (orange)
  const getStatusColor = () => {
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
  };

  // Get current symbol based on status
  const getCurrentSymbol = () => {
    if (manualOverride) {
      return awaySymbol;
    }
    return isOpen ? openSymbol : closedSymbol;
  };

  // Get status label
  const getStatusLabel = () => {
    if (manualOverride) return 'BORTA';
    return isOpen ? 'ÖPPET' : 'STÄNGT';
  };

  const currentSymbol = getCurrentSymbol();
  const statusColor = getStatusColor();
  const statusLabel = getStatusLabel();

  return (
    <Container maxWidth="md" sx={{ mt: 4, mb: 8 }}>
      <Box sx={{ textAlign: 'center', mb: 4 }}>
        <Typography variant="h3" component="h3" gutterBottom>
          Just nu
        </Typography>
        
        <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, mb: 4 }}>
          <Chip 
            icon={<Calendar size={16} />} 
            label={currentDay} 
            color="primary" 
            variant="outlined" 
          />
          <Chip 
            icon={<Clock size={16} />} 
            label={displayTime} 
            color="primary" 
            variant="outlined" 
          />
        </Box>
      </Box>

      <Paper 
        elevation={5} 
        sx={{ 
          p: 4, 
          textAlign: 'center',
          backgroundColor: statusColor.bg,
          borderRadius: 4,
          
        }}
      >
        {/* Status circle */}
        <Box 
          sx={{ 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center',
            mb: 3 
          }}
        >
          <Box 
            sx={{ 
              width: 375,
              height: 375,
              borderRadius: '50%',
              backgroundColor: statusColor.main,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              mb: 2,
              border: '8px solid',
              borderColor: statusColor.border,
              boxShadow: 3
            }}
          >
            {/* Show the appropriate symbol */}
            <>
              <Typography
                variant="h1" // <--- The size for the status text is defined here via the variant prop
                sx={{
                  color: '#fff',
                  fontWeight: 'bold',
                  fontSize: '5rem',
                  textShadow: '0 2px 8px rgba(0,0,0,0.25)',
                  mt: 1,
                  letterSpacing: 2,
                  textTransform: 'uppercase'
                }}
              >
                {statusLabel}
              </Typography>
            </>
          </Box>
          
          <Typography variant="h5" sx={{ fontWeight: 'bold', mb: 1 }}>
           
          </Typography>
        </Box>

        {/* Symbol Card */}
        <Card 
          elevation={2} 
          sx={{ 
            mb: 3,
            maxWidth: 400, 
            mx: 'auto',
            backgroundColor: statusColor.bg,
            border: '1px solid',
            borderColor: statusColor.border,
          }}
        >
          <CardContent sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <Box sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              my: 2,
              minHeight: 80
            }}>
              {currentSymbol ? (
                <Box 
                  component="img" 
                  src={currentSymbol.image_url} 
                  alt={manualOverride ? "Away Symbol" : (isOpen ? "Open Symbol" : "Closed Symbol")} 
                  sx={{ height: 120, maxWidth: 120 }} 
                />
              ) : (
                <Typography variant="body2" sx={{ color: 'text.secondary', fontStyle: 'italic' }}>
                  Ingen symbol vald
                </Typography>
              )}
            </Box>
            
            <Divider sx={{ width: '100%', my: 1.5 }} />
            
            <Typography variant="h5" sx={{ textAlign: 'center', mt: 1 }}>
              <Box component="span" sx={{ fontWeight: 'bold' }}>
            
              </Box>{' '}
              {getStatusMessage()}
            </Typography>
          </CardContent>
        </Card>

        {/* Simple time information */}
        <Box sx={{ mb: 2 }}>
          {manualOverride ? (
            <Typography variant="h4">
              Vi är snart tillbaka
            </Typography>
          ) : isOpen && currentTimeSlot ? (
            <Typography variant="h4">
              Öppet till {currentTimeSlot.end}
            </Typography>
          ) : nextOpening.day && nextOpening.time ? (
            <Typography variant="h4">
              Öppnar nästa gång: {nextOpening.day === currentDay ? 'Idag' : nextOpening.day} kl {nextOpening.time}
            </Typography>
          ) : (
            <Typography variant="body1">
              Inga kommande öppettider schemalagda
            </Typography>
          )}
        </Box>
        
        {/* Progress Bar when OPEN - Only show when open and not in away mode */}
        {isOpen && !manualOverride && currentTimeSlot && (
          <Box sx={{ mt: 4, mb: 2, width: '100%', maxWidth: 500, mx: 'auto' }}>
            <Typography variant="body1" sx={{ mb: 1, fontWeight: 'medium', color: 'text.secondary' }}>
              {timeUntilCloseText}
            </Typography>
            <LinearProgress 
              variant="determinate" 
              value={closeProgressPercent} 
              sx={{ 
                height: 20,
                borderRadius: 5,
                backgroundColor: 'rgba(0, 200, 0, 0.1)', 
                '& .MuiLinearProgress-bar': {
                  backgroundColor: 'success.main',
                  borderRadius: 5
                }
              }}
            />
          </Box>
        )}
        
        {/* Progress Bar when CLOSED - Only show when closed and not in away mode */}
        {!isOpen && !manualOverride && nextOpening.minutesUntil > 0 && (
          <Box sx={{ mt: 4, mb: 2, width: '100%', maxWidth: 500, mx: 'auto' }}>
            <Typography variant="body1" sx={{ mb: 1, fontWeight: 'medium', color: 'text.secondary' }}>
              {timeUntilOpenText}
            </Typography>
            <LinearProgress 
              variant="determinate" 
              value={progressPercent} 
              sx={{ 
                height: 20,
                borderRadius: 5,
                backgroundColor: 'rgba(200, 0, 0, 0.1)', 
                '& .MuiLinearProgress-bar': {
                  backgroundColor: 'error.main',
                  borderRadius: 5
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