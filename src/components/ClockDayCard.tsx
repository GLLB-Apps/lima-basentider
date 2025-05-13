import React from 'react';
import Clock from 'react-clock';
import 'react-clock/dist/Clock.css';
import { Box, Paper, Typography, BoxProps, PaperProps } from '@mui/material';

// Map short day names to full Swedish day names
export const fullDayNames: Record<string, string> = {
  'Mån': 'Måndag',
  'Tis': 'Tisdag',
  'Ons': 'Onsdag',
  'Tors': 'Torsdag',
  'Fre': 'Fredag',
  'Lör': 'Lördag',
  'Sön': 'Söndag'
};

// Map of day colors for consistent styling
export const dayColors: Record<string, string> = {
  'Mån': 'rgba(76, 175, 80, 0.5)',   // Green
  'Tis': 'rgba(33, 150, 243, 0.5)',  // Blue
  'Ons': 'rgba(255, 152, 0, 0.5)',   // Orange
  'Tors': 'rgba(156, 39, 176, 0.5)', // Purple
  'Fre': 'rgba(244, 67, 54, 0.5)',   // Red
  'Lör': 'rgba(96, 125, 139, 0.5)',  // Blue Gray
  'Sön': 'rgba(121, 85, 72, 0.5)'    // Brown
};

interface ClockDayCardProps {
  // Time/Clock props
  time: Date;
  clockSize?: number;
  clockContainerSize?: number;
  showSeconds?: boolean;
  clockContainerStyles?: BoxProps['sx'];
  
  // Day Card props
  day: string;
  date?: string;
  dayCardColor?: string;
  dayCardMinWidth?: number | string;
  useLongDayName?: boolean;
  dayCardElevation?: number;
  dayCardPaperProps?: Omit<PaperProps, 'elevation'>;
  
  // Layout props
  direction?: 'row' | 'column';
  gap?: number;
  containerStyles?: BoxProps['sx'];
  reverseOrder?: boolean;
  
  // Clock customization
  hourHandWidth?: number;
  minuteHandWidth?: number;
  secondHandWidth?: number;
  hourHandLength?: number;
  minuteHandLength?: number;
  secondHandLength?: number;
  renderMinuteMarks?: boolean;
  hourMarksLength?: number;
  hourMarksWidth?: number;
  minuteMarksLength?: number;
}

/**
 * A combined component that displays both an analog clock and a day card
 * Can be configured to display in row or column layout
 */
const ClockDayCard: React.FC<ClockDayCardProps> = ({
  // Clock props
  time,
  clockSize = 140,
  clockContainerSize = 160,
  showSeconds = true,
  clockContainerStyles = {},
  
  // Day Card props
  day,
  date,
  dayCardColor,
  dayCardMinWidth = 150,
  useLongDayName = true,
  dayCardElevation = 2,
  dayCardPaperProps = {},
  
  // Layout props
  direction = 'row',
  gap = 4,
  containerStyles = {},
  reverseOrder = false,
  
  // Clock customization
  hourHandWidth = 4,
  minuteHandWidth = 2,
  secondHandWidth = 1,
  hourHandLength = 50,
  minuteHandLength = 70,
  secondHandLength = 75,
  renderMinuteMarks = true,
  hourMarksLength = 12,
  hourMarksWidth = 2,
  minuteMarksLength = 6,
}) => {
  // Helper function to get proper day color
  const getDayColor = (): string => {
    // First check if custom color is provided via props
    if (dayCardColor) {
      return dayCardColor;
    }
    
    // Next try to use the predefined colors
    if (dayColors[day]) {
      return dayColors[day];
    }
    
    // Fallback to default color
    return 'rgba(25, 118, 210, 0.5)';
  };
  
  // Get the background color for day card
  const bgColor = getDayColor();
  
  // Get the full day name if needed
  const displayDay = useLongDayName ? (fullDayNames[day] || day) : day;
  
  // Determine the order of components based on reverseOrder
  const dayCardIndex = reverseOrder ? 2 : 1;
  const clockIndex = reverseOrder ? 1 : 2;
  
  return (
    <Box 
      sx={{ 
        display: 'flex', 
        flexDirection: direction,
        justifyContent: 'center', 
        alignItems: 'center', 
        gap,
        ...containerStyles
      }}
    >
      {/* Day Card */}
      <Box sx={{ order: dayCardIndex }}>
        <Paper 
          elevation={dayCardElevation} 
          {...dayCardPaperProps}
          sx={{ 
            px: 3, 
            py: 1.5, 
            borderRadius: 2,
            bgcolor: bgColor, // Apply the background color here
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minWidth: dayCardMinWidth,
            ...dayCardPaperProps.sx // Make sure this comes after to allow overrides
          }}
        >
          <Typography 
            variant="h4" 
            sx={{ 
              fontWeight: 'bold', 
              color: 'rgba(0,0,0,0.85)',
              mb: date ? 0.5 : 0
            }}
          >
            {displayDay}
          </Typography>
          
          {date && (
            <Typography 
              variant="h6" 
              sx={{ color: 'rgba(0,0,0,0.7)' }}
            >
              {date}
            </Typography>
          )}
        </Paper>
      </Box>
      
      {/* Analog Clock */}
      <Box sx={{ order: clockIndex }}>
        <Box sx={{ 
          p: 2, 
          borderRadius: '50%', 
          bgcolor: 'background.paper',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: 3,
          width: clockContainerSize,
          height: clockContainerSize,
          ...clockContainerStyles
        }}>
          <Clock 
            value={time}
            size={clockSize}
            renderNumbers={true}
            hourHandWidth={hourHandWidth}
            minuteHandWidth={minuteHandWidth}
            secondHandWidth={secondHandWidth}
            hourHandLength={hourHandLength}
            minuteHandLength={minuteHandLength}
            secondHandLength={secondHandLength}
            renderSecondHand={showSeconds}
            hourMarksLength={hourMarksLength}
            hourMarksWidth={hourMarksWidth}
            minuteMarksLength={minuteMarksLength}
            renderHourMarks={true}
            renderMinuteMarks={renderMinuteMarks}
          />
        </Box>
      </Box>
    </Box>
  );
};

export default ClockDayCard;