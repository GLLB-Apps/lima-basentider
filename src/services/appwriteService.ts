import { Client, Databases, Storage, ID, Query } from 'appwrite';
import { DaySchedule, TimeSlot, User, InboxMessage, Meeting } from '../types';
import { initialScheduleData, users as localUsers, dayColors } from '../data';

// Appwrite setup
const APPWRITE_ENDPOINT = process.env.REACT_APP_APPWRITE_ENDPOINT || '';
const APPWRITE_PROJECT_ID = process.env.REACT_APP_APPWRITE_PROJECT_ID || '';
const APPWRITE_DATABASE_ID = process.env.REACT_APP_APPWRITE_DATABASE_ID || '';
const COLLECTION_DAYS = '680a27860039285900c9';
const COLLECTION_TIME_SLOTS = '680a28460000a1ff1bb6';
const COLLECTION_USERS = '680a28de000cb9f2a8f8';
const COLLECTION_OVERRIDES = '680a3fb70038afad0364';
const DOCUMENT_OVERRIDE_ID = '680b61fa0002c4d2d61d';
const BUCKET_SYMBOLS = '680fc0ed0025e03d14b5';
const COLLECTION_SYMBOL_MESSAGES = 'COLLECTION_SYMBOL_MESSAGES'; // Collection ID for symbol messages
const DOCUMENT_SYMBOL_MESSAGES_ID = '68113585000120b05aa2'; // Document ID for symbol messages
const COLLECTION_INBOX = '681e3fff001cf5968f50'; // Collection ID for inbox messages
const COLLECTION_MEETINGS = '682090c4003338f0a3f4'; // Collection ID for meetings

if (!APPWRITE_ENDPOINT || !APPWRITE_PROJECT_ID || !APPWRITE_DATABASE_ID) {
  console.error('Missing Appwrite environment variables');
}

const client = new Client()
  .setEndpoint(APPWRITE_ENDPOINT)
  .setProject(APPWRITE_PROJECT_ID);

const databases = new Databases(client);
const storage = new Storage(client);

export { databases };

// Weekday order used for sorting
const weekdayOrder = ['Sön', 'Mån', 'Tis', 'Ons', 'Tors', 'Fre', 'Lör'];

// Schedule-related functions
export const getSchedule = async (): Promise<DaySchedule[]> => {
  try {
    const daysRes = await databases.listDocuments(APPWRITE_DATABASE_ID, COLLECTION_DAYS);
    const timeSlotsRes = await databases.listDocuments(APPWRITE_DATABASE_ID, COLLECTION_TIME_SLOTS);

    const grouped: DaySchedule[] = weekdayOrder.map((dayName): DaySchedule => {
      const dayDoc = daysRes.documents.find((doc: any) => doc.day === dayName);
      if (!dayDoc) return { id: '', day: dayName, color: dayColors[dayName], times: [] };

      const daySlots = timeSlotsRes.documents
        .filter((slot: any) => slot.day_id === dayDoc.$id)
        .map((slot: any) => ({
          id: slot.$id,
          start: slot.start,
          end: slot.end,
        }));

      return {
        id: dayDoc.$id,
        day: dayDoc.day,
        color: dayColors[dayDoc.day],
        times: daySlots
      };
    });

    return grouped;
  } catch (err) {
    console.error('Error fetching schedule:', err);
    return [];
  }
};

export const updateTimeSlot = async (timeSlotId: string, updates: Partial<TimeSlot>): Promise<boolean> => {
  try {
    await databases.updateDocument(APPWRITE_DATABASE_ID, COLLECTION_TIME_SLOTS, timeSlotId, updates);
    return true;
  } catch (err) {
    console.error('Error updating time slot:', err);
    return false;
  }
};

export const addTimeSlot = async (dayId: string, timeSlot: Omit<TimeSlot, 'id'>): Promise<TimeSlot | null> => {
  try {
    const doc = await databases.createDocument(APPWRITE_DATABASE_ID, COLLECTION_TIME_SLOTS, ID.unique(), {
      day_id: dayId,
      start: timeSlot.start,
      end: timeSlot.end,
    });

    return {
      id: doc.$id,
      start: doc.start,
      end: doc.end,
    };
  } catch (err) {
    console.error('Error adding time slot:', err);
    return null;
  }
};

export const deleteTimeSlot = async (timeSlotId: string): Promise<boolean> => {
  try {
    await databases.deleteDocument(APPWRITE_DATABASE_ID, COLLECTION_TIME_SLOTS, timeSlotId);
    return true;
  } catch (err) {
    console.error('Error deleting time slot:', err);
    return false;
  }
};

// User login-related functions
export const signIn = async (username: string, password: string): Promise<User | null> => {
  try {
    const res = await databases.listDocuments(APPWRITE_DATABASE_ID, COLLECTION_USERS, [
      Query.equal('username', [username]),
      Query.equal('password', [password]),
    ]);

    if (res.documents.length === 1) {
      const user = res.documents[0];
      return {
        username: user.username,
        password: '',
        isAdmin: user.is_admin,
        name: user.name,
      };
    }

    return null;
  } catch (err) {
    console.error('Error in signIn:', err);
    return null;
  }
};

export const signOut = async (): Promise<boolean> => {
  return true;
};

// Override status (manual override settings) - UPDATED
export const getOverrideStatus = async () => {
  try {
    const doc = await databases.getDocument(APPWRITE_DATABASE_ID, COLLECTION_OVERRIDES, DOCUMENT_OVERRIDE_ID);
    console.log("Loaded override status from database:", doc);
    return {
      manualOverride: doc.manualOverride === true, // Ensure boolean conversion
      message: doc.message || '',
    };
  } catch (err) {
    console.error('Error fetching override:', err);
    // Create the document if it doesn't exist
    try {
      await prepareOverrideDocument();
      console.log("Created new override document with default values");
      return { manualOverride: false, message: '' };
    } catch (createErr) {
      console.error('Error creating override document:', createErr);
      return { manualOverride: false, message: '' };
    }
  }
};

// UPDATED for better persistence
export const updateOverrideStatus = async (manualOverride: boolean, message: string): Promise<boolean> => {
  try {
    console.log("Saving override to database:", { manualOverride, message });
    
    await databases.updateDocument(APPWRITE_DATABASE_ID, COLLECTION_OVERRIDES, DOCUMENT_OVERRIDE_ID, {
      manualOverride: manualOverride,
      message: message,
    });
    
    console.log("Successfully saved override status");
    return true;
  } catch (err: any) {
    if (err?.message?.includes('Document not found')) {
      try {
        console.log("Override document not found, creating new one");
        await prepareOverrideDocument();
        
        // Try updating again after creating
        await databases.updateDocument(APPWRITE_DATABASE_ID, COLLECTION_OVERRIDES, DOCUMENT_OVERRIDE_ID, {
          manualOverride: manualOverride,
          message: message,
        });
        
        console.log("Successfully created and updated override document");
        return true;
      } catch (createErr) {
        console.error('Error creating and updating override document:', createErr);
        return false;
      }
    }
    console.error('Error updating override:', err);
    return false;
  }
};

export const prepareOverrideDocument = async (): Promise<boolean> => {
  try {
    console.log("Creating override document with ID:", DOCUMENT_OVERRIDE_ID);
    
    await databases.createDocument(APPWRITE_DATABASE_ID, COLLECTION_OVERRIDES, DOCUMENT_OVERRIDE_ID, {
      manualOverride: false,
      message: 'Strax tillbaka'
    });
    
    console.log("Successfully created override document");
    return true;
  } catch (err) {
    console.error('Error preparing override document:', err);
    return false;
  }
};

// Helper function to convert SVG to PNG blob
const svgToPngBlob = async (svgString: string): Promise<Blob | null> => {
  return new Promise((resolve) => {
    try {
      // Create a blob URL for the SVG
      const svgBlob = new Blob([svgString], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(svgBlob);
      
      // Create image element
      const img = new Image();
      img.onload = () => {
        // Create canvas with appropriate dimensions
        const canvas = document.createElement('canvas');
        canvas.width = img.width || 200;  // Default to 200 if width is 0
        canvas.height = img.height || 200; // Default to 200 if height is 0
        
        // Draw image on canvas
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          console.error('Could not get canvas context');
          URL.revokeObjectURL(url);
          resolve(null);
          return;
        }
        
        ctx.drawImage(img, 0, 0);
        URL.revokeObjectURL(url);
        
        // Convert canvas to blob
        canvas.toBlob((blob) => {
          resolve(blob);
        }, 'image/png');
      };
      
      img.onerror = () => {
        console.error('Error loading SVG into image');
        URL.revokeObjectURL(url);
        resolve(null);
      };
      
      img.src = url;
    } catch (err) {
      console.error('Error converting SVG to PNG:', err);
      resolve(null);
    }
  });
};

// Updated to support 'away' type
export const uploadSymbol = async (type: 'open' | 'closed' | 'away', svgString: string): Promise<string | null> => {
  try {
    console.log(`Uploading ${type} symbol...`);
    
    // Convert SVG to PNG using canvas
    const pngBlob = await svgToPngBlob(svgString);
    if (!pngBlob) {
      console.error('Failed to convert SVG to PNG');
      return null;
    }

    // Create a proper File object from the Blob
    // This follows the Appwrite example where they use an actual File object
    const file = new File([pngBlob], `${type}.png`, { 
      type: 'image/png'
    });

    const fileId = ID.custom(type);

    // Try to delete the file if it exists
    try {
      await storage.getFile(BUCKET_SYMBOLS, fileId);
      await storage.deleteFile(BUCKET_SYMBOLS, fileId);
      console.log(`Deleted existing ${type} file`);
    } catch (fileErr) {
      console.log(`${type} file does not exist yet or could not be deleted`);
    }

    // Upload the file exactly as shown in the Appwrite example
    const result = await storage.createFile(
      BUCKET_SYMBOLS,
      fileId,
      file
    );

    console.log(`${type} file upload result:`, result);

    // Return the URL to the uploaded file
    const fileUrl = `${APPWRITE_ENDPOINT}/storage/buckets/${BUCKET_SYMBOLS}/files/${fileId}/view?project=${APPWRITE_PROJECT_ID}`;
    console.log(`${type} symbol URL:`, fileUrl);
    return fileUrl;
  } catch (err) {
    console.error(`Error uploading ${type} symbol:`, err);
    if (err instanceof Error) {
      console.error('Error details:', err.message);
    }
    return null;
  }
};

// Get URL for a symbol - updated to support 'away' type
export const getSymbolUrl = (type: 'open' | 'closed' | 'away'): string => {
  const url = `${APPWRITE_ENDPOINT}/storage/buckets/${BUCKET_SYMBOLS}/files/${type}/view?project=${APPWRITE_PROJECT_ID}`;
  console.log(`Getting URL for ${type} symbol:`, url);
  return url;
};

// Save a message for a symbol - updated to support 'away' type
export const saveSymbolMessage = async (type: 'open' | 'closed' | 'away', message: string): Promise<boolean> => {
  try {
    console.log(`Saving ${type} message:`, message);
    
    // Try to get existing messages document
    try {
      const existingDoc = await databases.getDocument(
        APPWRITE_DATABASE_ID,
        COLLECTION_SYMBOL_MESSAGES,
        DOCUMENT_SYMBOL_MESSAGES_ID
      );
      
      console.log("Found existing symbol messages document:", existingDoc);
      
      // Update the existing document with the new message
      const updates: { openMessage?: string; closedMessage?: string; awayMessage?: string } = {};
      if (type === 'open') {
        updates.openMessage = message;
      } else if (type === 'closed') {
        updates.closedMessage = message;
      } else if (type === 'away') {
        updates.awayMessage = message;
      }
      
      await databases.updateDocument(
        APPWRITE_DATABASE_ID,
        COLLECTION_SYMBOL_MESSAGES,
        DOCUMENT_SYMBOL_MESSAGES_ID,
        updates
      );
      
      console.log(`Successfully saved ${type} message`);
      return true;
    } catch (err) {
      // If document doesn't exist, create it
      if ((err as any)?.message?.includes('Document not found')) {
        console.log("Symbol messages document not found, creating new one");
        
        const data: { openMessage?: string; closedMessage?: string; awayMessage?: string } = {};
        if (type === 'open') {
          data.openMessage = message;
        } else if (type === 'closed') {
          data.closedMessage = message;
        } else if (type === 'away') {
          data.awayMessage = message;
        }
        
        await databases.createDocument(
          APPWRITE_DATABASE_ID,
          COLLECTION_SYMBOL_MESSAGES,
          DOCUMENT_SYMBOL_MESSAGES_ID,
          data
        );
        
        console.log(`Successfully created symbol messages document with ${type} message`);
        return true;
      }
      
      throw err;
    }
  } catch (err) {
    console.error(`Error saving ${type} symbol message:`, err);
    return false;
  }
};

// Get messages for symbols - updated to include away message
export const getSymbolMessages = async (): Promise<{ 
  openMessage?: string; 
  closedMessage?: string;
  awayMessage?: string;
} | null> => {
  try {
    console.log("Getting symbol messages...");
    
    const doc = await databases.getDocument(
      APPWRITE_DATABASE_ID,
      COLLECTION_SYMBOL_MESSAGES,
      DOCUMENT_SYMBOL_MESSAGES_ID
    );
    
    console.log("Retrieved symbol messages:", doc);
    
    return {
      openMessage: doc.openMessage || '',
      closedMessage: doc.closedMessage || '',
      awayMessage: doc.awayMessage || 'Borta för tillfället'
    };
  } catch (err) {
    console.error('Error fetching symbol messages:', err);
    // Return empty messages if document doesn't exist yet
    if ((err as any)?.message?.includes('Document not found')) {
      console.log("Symbol messages document not found, returning default values");
      return { openMessage: '', closedMessage: '', awayMessage: '' };
    }
    return null;
  }
};

// INBOX FUNCTIONS

// Get all inbox messages
export const getInboxMessages = async (): Promise<InboxMessage[]> => {
  try {
    console.log("Fetching inbox messages...");
    
    const response = await databases.listDocuments(
      APPWRITE_DATABASE_ID,
      COLLECTION_INBOX,
      [Query.orderDesc('$createdAt')] // Latest messages first using Appwrite's built-in field
    );
    
    console.log("Retrieved inbox messages:", response.documents.length);
    
    return response.documents.map(doc => ({
      id: doc.$id,
      title: doc.title,
      content: doc.content,
      date: new Date(doc.$createdAt).toISOString().split('T')[0], // Convert Appwrite's timestamp to YYYY-MM-DD
      isRead: doc.isRead
    }));
  } catch (err) {
    console.error('Error fetching inbox messages:', err);
    return [];
  }
};

// Create a new inbox message (for non-logged-in users)
export const createInboxMessage = async (message: { title: string; content: string }): Promise<InboxMessage | null> => {
  try {
    console.log("Creating new inbox message:", message);
    
    const response = await databases.createDocument(
      APPWRITE_DATABASE_ID,
      COLLECTION_INBOX,
      ID.unique(),
      {
        title: message.title,
        content: message.content,
        isRead: false
      }
    );
    
    console.log("Successfully created inbox message:", response.$id);
    
    return {
      id: response.$id,
      title: response.title,
      content: response.content,
      date: new Date(response.$createdAt).toISOString().split('T')[0], // Use Appwrite's built-in $createdAt
      isRead: response.isRead
    };
  } catch (err) {
    console.error('Error creating inbox message:', err);
    return null;
  }
};

// Mark a message as read (for logged-in users)
export const markMessageAsRead = async (id: string): Promise<boolean> => {
  try {
    console.log("Marking message as read:", id);
    
    await databases.updateDocument(
      APPWRITE_DATABASE_ID,
      COLLECTION_INBOX,
      id,
      { isRead: true }
    );
    
    console.log("Successfully marked message as read");
    return true;
  } catch (err) {
    console.error('Error marking message as read:', err);
    return false;
  }
};

// Delete an inbox message (for logged-in users)
export const deleteInboxMessage = async (id: string): Promise<boolean> => {
  try {
    console.log("Deleting inbox message:", id);
    
    await databases.deleteDocument(
      APPWRITE_DATABASE_ID,
      COLLECTION_INBOX,
      id
    );
    
    console.log("Successfully deleted inbox message");
    return true;
  } catch (err) {
    console.error('Error deleting inbox message:', err);
    return false;
  }
};

// MEETINGS FUNCTIONS

// Get all meetings
export const getAllMeetings = async (): Promise<Meeting[]> => {
  try {
    const response = await databases.listDocuments(
      APPWRITE_DATABASE_ID,
      COLLECTION_MEETINGS,
      [Query.orderAsc('date')] // Sort by date ascending
    );

    console.log("Retrieved meetings:", response.documents.length);
    
    return response.documents.map(doc => ({
      id: doc.$id,
      date: doc.date,
      time: doc.time || '10:00' // Include time with default
    }));
  } catch (err) {
    console.error('Error fetching meetings:', err);
    return [];
  }
};

// Get meetings by date range
export const getMeetingsByDateRange = async (startDate: string, endDate: string): Promise<Meeting[]> => {
  try {
    const response = await databases.listDocuments(
      APPWRITE_DATABASE_ID,
      COLLECTION_MEETINGS,
      [
        Query.greaterThanEqual('date', startDate),
        Query.lessThanEqual('date', endDate),
        Query.orderAsc('date')
      ]
    );

    console.log(`Retrieved meetings between ${startDate} and ${endDate}:`, response.documents.length);
    
    return response.documents.map(doc => ({
      id: doc.$id,
      date: doc.date,
      time: doc.time || '10:00' // Include time with default
    }));
  } catch (err) {
    console.error('Error fetching meetings by date range:', err);
    return [];
  }
};

// Create a new meeting with time
export const createMeeting = async (date: string, time: string = '10:00'): Promise<Meeting | null> => {
  try {
    console.log("Creating new meeting for date:", date, "time:", time);
    
    const response = await databases.createDocument(
      APPWRITE_DATABASE_ID,
      COLLECTION_MEETINGS,
      ID.unique(),
      { 
        date,
        time
      }
    );
    
    console.log("Successfully created meeting:", response.$id);
    
    return {
      id: response.$id,
      date: response.date,
      time: response.time
    };
  } catch (err) {
    console.error('Error creating meeting:', err);
    return null;
  }
};

// Get a specific meeting by ID
export const getMeetingById = async (id: string): Promise<Meeting | null> => {
  try {
    console.log("Fetching meeting by ID:", id);
    
    const response = await databases.getDocument(
      APPWRITE_DATABASE_ID,
      COLLECTION_MEETINGS,
      id
    );
    
    console.log("Successfully retrieved meeting:", response.$id);
    
    return {
      id: response.$id,
      date: response.date,
      time: response.time || '10:00' // Include time with default
    };
  } catch (err) {
    console.error('Error fetching meeting by ID:', err);
    return null;
  }
};

// Update a meeting with time
export const updateMeeting = async (id: string, date: string, time?: string): Promise<boolean> => {
  try {
    console.log("Updating meeting:", id, "with new date:", date, "and time:", time);
    
    const updateData: { date: string; time?: string } = { date };
    
    // Only include time in the update if it's provided
    if (time !== undefined) {
      updateData.time = time;
    }
    
    await databases.updateDocument(
      APPWRITE_DATABASE_ID,
      COLLECTION_MEETINGS,
      id,
      updateData
    );
    
    console.log("Successfully updated meeting");
    return true;
  } catch (err) {
    console.error('Error updating meeting:', err);
    return false;
  }
};

// Delete a meeting
export const deleteMeeting = async (id: string): Promise<boolean> => {
  try {
    console.log("Deleting meeting:", id);
    
    await databases.deleteDocument(
      APPWRITE_DATABASE_ID,
      COLLECTION_MEETINGS,
      id
    );
    
    console.log("Successfully deleted meeting");
    return true;
  } catch (err) {
    console.error('Error deleting meeting:', err);
    return false;
  }
};