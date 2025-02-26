import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, enableIndexedDbPersistence } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyBimOLmmDlkYaI9S9Y2kNOlRz7C5gNrnBw",
  authDomain: "tempchat-e401a.firebaseapp.com",
  projectId: "tempchat-e401a",
  storageBucket: "tempchat-e401a.appspot.com", // Fixed storage bucket format
  messagingSenderId: "1062307394357",
  appId: "1:1062307394357:web:b00f60e9245553cb1f127c"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// Enable offline persistence if needed
// enableIndexedDbPersistence(db).catch((err) => {
//   console.error('Firestore persistence error:', err.code);
// });

// NOTE: This project requires a composite index on the "messages" collection
// for queries that filter by roomId and sort by timestamp.
// If you see index errors, create the index by visiting:
// https://console.firebase.google.com/v1/r/project/tempchat-e401a/firestore/indexes?create_composite=Ck9wcm9qZWN0cy90ZW1wY2hhdC1lNDAxYS9kYXRhYmFzZXMvKGRlZmF1bHQpL2NvbGxlY3Rpb25Hcm91cHMvbWVzc2FnZXMvaW5kZXhlcy9fEAEaCgoGcm9vbUlkEAEaDQoJdGltZXN0YW1wEAEaDAoIX19uYW1lX18QAQ

export { app, auth, db, storage };