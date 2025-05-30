export interface TimeSlot {
    id: string;         // Changed from number to string
    start: string;
    end: string;
  }
  
  export interface DaySchedule {
    id: string;         // Changed from number to string
    day: string;
    color: string;
    times: TimeSlot[];
  }
  
  export interface User {
    username: string;
    password: string;
    isAdmin: boolean;
    name: string;
  }
  
  export interface NextOpening {
    day: string;
    time: string;
    minutesUntil: number;
  } 

  export interface InboxMessage {
    id: string;
    title: string;
    content: string;
    date: string;
    isRead: boolean;
  }

  // New Meeting type for our meetings backend
export interface Meeting {
  id: string;
  date: string;
  time: string;
}