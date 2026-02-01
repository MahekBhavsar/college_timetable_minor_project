export interface Staff {
  id?: string;          // Firestore Document ID (mapped via idField: 'id')
  staffId: string;      // Your custom Employee/Faculty ID
  staffName: string;    // Full Name
  email: string;        // Email address
  password?: string;    // Optional: for creation/updates
  role: 'staff' | 'admin'; 
  semester?: number;    // From your ManageStaff component
  subjectIds?: string[]; // Array of assigned subject IDs
  createdAt?: any;      // Firestore Timestamp
}