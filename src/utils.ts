// Helper function to convert "HH:MM" to minutes since midnight
export const timeToMinutes = (time: string): number => {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  };
  
  // Helper to get day of week in Swedish
  export const getDayOfWeekSwedish = (date: Date): string => {
    const days = ['Sön', 'Mån', 'Tis', 'Ons', 'Tors', 'Fre', 'Lör'];
    return days[date.getDay()];
  };
  
  // Get current time in minutes
  export const getCurrentTimeInMinutes = (): number => {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
  };
  
  // Get current day index (0-6, 0 is Monday in our data)
  export const getCurrentDayIndex = (): number => {
    const now = new Date();
    // Convert from Sunday=0 to Monday=0
    let day = now.getDay() - 1;
    if (day === -1) day = 6; // Sunday becomes 6
    return day;
  };
  
  // Format minutes as hours and minutes
  export const formatMinutesAsTime = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    
    if (hours === 0) {
      return `${mins} minuter`;
    } else if (hours === 1 && mins === 0) {
      return `1 timme`;
    } else if (hours >= 1 && mins === 0) {
      return `${hours} timmar`;
    } else {
      return `${hours} timmar och ${mins} minuter`;
    }
  };
  
  // Generate a unique ID
  export const generateId = (): number => {
    return Math.floor(Math.random() * 10000);
  };
  
  // Calculate progress for the time until opening (0-100%)
  export const calculateProgress = (minutesUntil: number): number => {
    // If we're more than 12 hours away, cap at 12 hours for the progress bar
    const maxMinutes = 12 * 60;
    const minutesForCalc = Math.min(minutesUntil, maxMinutes);
    
    // Invert the progress (100% means it's opening now, 0% means it's far away)
    return 100 - (minutesForCalc / maxMinutes * 100);
  };