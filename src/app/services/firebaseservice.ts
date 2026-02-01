import { Injectable } from '@angular/core';
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
import { Observable, from, map } from 'rxjs';
import { FirebaseCollections } from '../services/firebase-enums';
import { RegistrationUserData } from '../Interfaces/user';

import { initializeApp } from 'firebase/app';
import {
  Auth,
  getAuth,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';

import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { firebaseConfig } from '../../firebaseconfig';

@Injectable({
  providedIn: 'root',
})
export class FirebaseService {

  /* ---------------- FIREBASE INIT ---------------- */
  private app = initializeApp(firebaseConfig);
  private auth: Auth = getAuth(this.app);

  constructor(private readonly firestore: Firestore) {}

  /* =================================================
     🔐 LOGIN METHODS
     ================================================= */

  /** 🔑 Admin login via Firestore (email + password field) */
  // Inside services/firebaseservice.ts

async adminLogin(email: string, pass: string) {
  // 1. Try to find user in Admin collection
  const adminQuery = query(collection(this.firestore, 'admin'), 
                     where('email', '==', email), 
                     where('password', '==', pass));
  const adminSnap = await getDocs(adminQuery);

  if (!adminSnap.empty) {
    const data = adminSnap.docs[0].data();
    return { ...data, role: 'admin' }; // Force role 'admin'
  }

  // 2. If not found, try to find user in Staff collection
  const staffQuery = query(collection(this.firestore, 'staff'), 
                     where('email', '==', email), 
                     where('password', '==', pass));
  const staffSnap = await getDocs(staffQuery);

  if (!staffSnap.empty) {
    const data = staffSnap.docs[0].data();
    return { ...data, role: 'staff' }; // Force role 'staff'
  }

  return null; // No user found in either collection
}
  /** 🔐 Firebase Auth login (optional, future-proof) */
  authLogin(email: string, password: string) {
    return signInWithEmailAndPassword(this.auth, email, password);
  }

  logout() {
    return signOut(this.auth);
  }

  /* =================================================
     📄 APPLICATION METHODS
     ================================================= */

/* Inside services/firebaseservice.ts */

public getFilteredCollection<T extends DocumentData>(
  collectionName: string,
  filterField: string,
  filterValue: any // Change this from string to any
): Observable<T[]> {
  const collectionRef = collection(this.firestore, collectionName);
  const q = query(collectionRef, where(filterField, '==', filterValue));

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
     🔥 FIRESTORE CRUD (UNCHANGED STYLE)
     ================================================= */

   public getCollection<T extends DocumentData>(
    collectionName: FirebaseCollections
  ): Observable<T[]> {
    const collectionRef = collection(this.firestore, collectionName);
    const collectionQuery = query(collectionRef);

    return new Observable<T[]>(subscriber => {
      // onSnapshot listens for any change in the DB and pushes it to the app
      const unsubscribe = onSnapshot(collectionQuery, (snapshot) => {
        const data = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        })) as unknown as T[];
        subscriber.next(data);
      }, (error) => subscriber.error(error));

      // Clean up listener when the component/subscription is destroyed
      return () => unsubscribe();
    });
  }
  public getDocument<T extends DocumentData>(
    collectionName: FirebaseCollections,
    documentId: string
  ): Observable<T | undefined> {
    const collectionRef = collection(this.firestore, collectionName);
    const docRef = doc(collectionRef, documentId);
    return from(getDoc(docRef)).pipe(
      map(snapshot => {
        if (!snapshot.exists()) return undefined;
        return {
          id: snapshot.id,
          ...snapshot.data(),
        } as unknown as T;
      })
    );
  }

  public addDocument<T extends DocumentData>(
    collectionName: FirebaseCollections,
    document: T
  ): Promise<DocumentReference<T>> {
    const collectionRef = collection(
      this.firestore,
      collectionName
    ) as CollectionReference<T, DocumentData>;
    return addDoc(collectionRef, document);
  }

  public updateDocument<T extends DocumentData>(
    collectionName: FirebaseCollections,
    documentId: string,
    document: UpdateData<T>
  ): Promise<void> {
    const collectionRef = collection(this.firestore, collectionName);
    const docRef = doc(
      collectionRef,
      documentId
    ) as DocumentReference<T, DocumentData>;
    return updateDoc(docRef, document);
  }

  public deleteDocument(
    collectionName: FirebaseCollections,
    documentId: string
  ): Promise<void> {
    const collectionRef = collection(this.firestore, collectionName);
    const docRef = doc(collectionRef, documentId);
    return deleteDoc(docRef);
  }

  /* =================================================
     📁 FILE UPLOAD
     ================================================= */

  async uploadFile(path: string, file: File) {
    const storage = getStorage();
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(storageRef);
    return { downloadURL };
  }
}
