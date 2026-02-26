import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
  CollectionReference,
  DocumentData,
  DocumentReference,
  Firestore,
  UpdateData,
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  updateDoc,
  where,
} from '@angular/fire/firestore';
import { Observable, firstValueFrom, from, map } from 'rxjs';
import { FirebaseCollections } from '../services/firebase-enums';
import { initializeApp } from 'firebase/app';
import {
  Auth,
  getAuth,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';

import { getStorage, ref, getDownloadURL, uploadString } from 'firebase/storage';
import { firebaseConfig } from '../../firebaseconfig';

@Injectable({
  providedIn: 'root',
})
export class FirebaseService {

  /* ---------------- FIREBASE INIT ---------------- */
  private app = initializeApp(firebaseConfig);
  private auth: Auth = getAuth(this.app);

  constructor(
    private readonly firestore: Firestore,
    private http: HttpClient 
  ) {}

  /* =================================================
      🔐 AUTH & LOGIN METHODS
     ================================================= */

  async commonLogin(email: string, password: string) {
    const collections = [
      { name: 'admin', role: 'admin' },
      { name: 'staff', role: 'staff' },
      { name: 'Application', role: 'student' }
    ];

    for (const col of collections) {
      const q = query(collection(this.firestore, col.name), where('email', '==', email));
      const snap = await getDocs(q);

      if (!snap.empty) {
        const userData = snap.docs[0].data();
        if (userData['password']?.toString() !== password) continue; 

        if (col.role === 'student') {
          const status = (userData['status'] || '').toString().toLowerCase();
          if (!status.includes('approved')) throw new Error("Your account is not approved yet.");
        }

        return { id: snap.docs[0].id, ...userData, role: col.role };
      }
    }
    return null; 
  }

  async adminLogin(email: string, password: string) {
    const collections = [{ name: 'admin', role: 'admin' }, { name: 'staff', role: 'staff' }];
    for (const col of collections) {
      const q = query(
        collection(this.firestore, col.name),
        where('email', '==', email.trim().toLowerCase()),
        where('password', '==', password.trim())
      );
      const snap = await getDocs(q);
      if (!snap.empty) return { id: snap.docs[0].id, ...snap.docs[0].data(), role: col.role };
    }
    return null;
  }

  logout() { return signOut(this.auth); }

  /* =================================================
      🔥 CRUD METHODS (Fixes TS2339 Errors)
     ================================================= */

  public addDocument<T extends DocumentData>(
    collectionName: string | FirebaseCollections,
    document: T
  ): Promise<DocumentReference<T>> {
    const collectionRef = collection(this.firestore, collectionName as string) as CollectionReference<T, DocumentData>;
    return addDoc(collectionRef, document);
  }

  public deleteDocument(
    collectionName: string | FirebaseCollections,
    documentId: string
  ): Promise<void> {
    const docRef = doc(this.firestore, collectionName as string, documentId);
    return deleteDoc(docRef);
  }

  public getDocument<T extends DocumentData>(
    collectionName: FirebaseCollections,
    documentId: string
  ): Observable<T | undefined> {
    const docRef = doc(this.firestore, collectionName, documentId);
    return from(getDoc(docRef)).pipe(
      map(snapshot => snapshot.exists() ? ({ id: snapshot.id, ...snapshot.data() } as unknown as T) : undefined)
    );
  }

  public updateDocument<T extends DocumentData>(
    collectionName: FirebaseCollections,
    documentId: string,
    document: UpdateData<T>
  ): Promise<void> {
    const docRef = doc(this.firestore, collectionName, documentId) as DocumentReference<T, DocumentData>;
    return updateDoc(docRef, document);
  }

  /* =================================================
      📊 DATA FETCHING METHODS (Fixes TS2352 Errors)
     ================================================= */

  public getCollection<T extends DocumentData>(collectionName: string | FirebaseCollections): Observable<T[]> {
    const q = query(collection(this.firestore, collectionName as string));
    return new Observable<T[]>(subscriber => {
      const unsubscribe = onSnapshot(q, (snap) => {
        subscriber.next(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as unknown as T)));
      }, err => subscriber.error(err));
      return () => unsubscribe();
    });
  }

  public getFilteredCollection<T extends DocumentData>(collectionName: string, field: string, value: any): Observable<T[]> {
    const q = query(collection(this.firestore, collectionName), where(field, '==', value));
    return new Observable<T[]>(subscriber => {
      const unsubscribe = onSnapshot(q, (snap) => {
        subscriber.next(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as unknown as T)));
      }, err => subscriber.error(err));
      return () => unsubscribe();
    });
  }

  public getMultipleFilteredCollection<T extends DocumentData>(
    collectionName: string,
    filters: { field: string; value: any }[]
  ): Observable<T[]> {
    const collectionRef = collection(this.firestore, collectionName);
    const constraints = filters.map(f => where(f.field, '==', f.value));
    const q = query(collectionRef, ...constraints);

    return new Observable<T[]>(subscriber => {
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const data = snapshot.docs.map(doc => ({
          id: doc.id,
          ...(doc.data() as T),
        }));
        subscriber.next(data);
      }, (error) => subscriber.error(error));

      return () => unsubscribe();
    });
  }

  /* =================================================
      📁 STORAGE & 🔔 REMINDERS (NODEMAILER)
     ================================================= */

  async uploadBase64(path: string, base64String: string) {
    const storage = getStorage(this.app);
    const storageRef = ref(storage, path);
    const snapshot = await uploadString(storageRef, base64String, 'data_url');
    const downloadURL = await getDownloadURL(snapshot.ref);
    return { downloadURL };
  }

  async checkAndSendReminders() {
    console.log("🚀 Starting Reminder Process...");
    const today = new Date();
    const target = new Date();
    target.setDate(today.getDate() + 3);
    const dateStr = target.toISOString().split('T')[0];

    const assignments = await firstValueFrom(this.getFilteredCollection<any>('assignments', 'date', dateStr));
    if (assignments.length === 0) {
      alert(`No pending assignments due in 3 days (Date: ${dateStr})`);
      return;
    }

    const students = await firstValueFrom(this.getFilteredCollection<any>('Application', 'status', 'Application approved by staff'));
    let count = 0;

    for (const assign of assignments) {
      for (const student of students) {
        const hasSubmitted = await this.checkSubmission(student.id, assign.id);
        if (!hasSubmitted) {
          try {
            await this.triggerEmail(student.email, assign.title, student.name);
            count++;
            console.log(`🚀 Email sent to ${student.email}`);
          } catch (emailErr) {
            console.error(`❌ Failed to send to ${student.name}:`, emailErr);
          }
        }
      }
    }

    if (count > 0) {
      alert(`Successfully processed ${count} reminders.`);
    } else {
      alert("All students for assignments due in 3 days have already submitted.");
    }
  }

  async checkSubmission(studentId: string, assignmentId: string): Promise<boolean> {
    const q = query(
      collection(this.firestore, 'assignment_submissions'),
      where('studentId', '==', studentId),
      where('assignmentId', '==', assignmentId)
    );
    const snap = await getDocs(q);
    return !snap.empty;
  }

  private async triggerEmail(email: string, title: string, name: string) {
  const url = 'http://localhost:3000/send-email';
  const payload = { 
    to: email.trim(), 
    subject: `Reminder: ${title}`, 
    studentName: name, 
    assignmentTitle: title,
    type: 'reminder' // 👈 Tells backend to use the Reminder look
  };
  return await firstValueFrom(this.http.post(url, payload));
}
  /* Inside src/app/services/firebaseservice.ts */

/** * 📄 Helper: Uploads a document and saves the application 
 * This is used during the Student Registration process.
 */
/* Inside src/app/services/firebaseservice.ts */

/** 📄 Saves application data with a Base64 string directly in Firestore */
async registerWithDocument(studentData: any, base64File: string) {
  const finalData = {
    ...studentData,
    verificationDocBase64: base64File, // Stored as a plain string
    status: 'pending', 
    appliedAt: new Date().toISOString()
  };

  // Saves to the 'Application' collection
  return await this.addDocument('Application' as any, finalData);
}

/** * 📧 Helper: Sends an Approval Email via Nodemailer
 * Call this when a staff member clicks "Verify/Approve"
 */
async sendApprovalEmail(targetEmail: string, studentName: string) {
  const url = 'http://localhost:3000/send-email';
  const payload = {
    to: targetEmail.trim(),
    subject: 'Welcome! Your Application is Approved',
    studentName: studentName,
    assignmentTitle: 'N/A',
    type: 'approval' // 👈 Tells backend to use the Approval look
  };
  return await firstValueFrom(this.http.post(url, payload));
}
}