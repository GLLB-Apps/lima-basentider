import { User, DaySchedule } from './types';

// Sample user data
export const users: User[] = [
  { username: 'lima', password: 'limahby', isAdmin: true, name: 'Admin' },
  { username: 'user1', password: 'user123', isAdmin: false, name: 'User 1' }
];

// Initial schedule data using Appwrite document-friendly string IDs (without colors)
export const initialScheduleData: Omit<DaySchedule, 'color'>[] = [
  {
    id: 'day_1',
    day: 'Mån',
    times: []
  },
  {
    id: 'day_2',
    day: 'Tis',
    times: []
  },
  {
    id: 'day_3',
    day: 'Ons',
    times: []
  },
  {
    id: 'day_4',
    day: 'Tors',
    times: []
  },
  {
    id: 'day_5',
    day: 'Fre',
    times: []
  },
  {
    id: 'day_6',
    day: 'Lör',
    times: []
  },
  {
    id: 'day_7',
    day: 'Sön',
    times: []
  }
];

// Export a lookup object for vibrant colors by day name (using rgba)
export const dayColors: {[key: string]: string} = {
  'Mån': 'rgba(127, 238, 105, 0.99)',     // Vibrant green
  'Tis': 'rgb(121, 201, 248)',    // Deeper blue
  'Ons': 'rgb(255, 255, 255)',   // Deeper purple
  'Tors': 'rgb(201, 147, 100)',  // Deeper orange
  'Fre': 'rgb(228, 207, 134)',   // Deeper yellow
  'Lör': 'rgb(250, 185, 183)',    // Deeper red
  'Sön': 'rgb(243, 122, 122)'     // Deeper teal
};