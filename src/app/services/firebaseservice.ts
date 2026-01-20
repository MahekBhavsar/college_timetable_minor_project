import { Injectable } from '@angular/core';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, signOut, Auth } from 'firebase/auth';

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
  query,
  updateDoc,
  where,
} from '@angular/fire/firestore';
import { Observable, from, map } from 'rxjs';
import { FirebaseCollections } from '../services/firebase-enums';

import { firebaseConfig } from '../../firebaseconfig';

@Injectable({
  providedIn: 'root',
})
export class FirebaseService {
  private app = initializeApp(firebaseConfig); // Initialize Firebase app
  private auth: Auth = getAuth(this.app);      // Initialize Auth with app

  constructor(private readonly firestore: Firestore) {}

  async adminLogin(email: string, password: string) {
  const adminRef = collection(this.firestore, FirebaseCollections.Admin);
  const q = query(adminRef, where("email", "==", email.trim()));
  const querySnapshot = await getDocs(q);

  if (querySnapshot.empty) {
    throw new Error('Invalid Admin Credentials');
  }

  let adminData = null;
  querySnapshot.forEach((doc) => {
    const data = doc.data();
    if (data['password'] === password) {
      adminData = { id: doc.id, ...data };
    }
  });

  if (!adminData) {
    throw new Error('Invalid Admin Credentials');
  }

  return adminData;
}


  logout() {
    return signOut(this.auth);
  }

  // ... your other firestore CRUD methods unchanged ...


  // ============================
  // 🔥 FIRESTORE CRUD METHODS
  // ============================

  public getCollection<T extends DocumentData>(
    collectionName: FirebaseCollections
  ): Observable<T[]> {
    const collectionRef = collection(this.firestore, collectionName);
    const collectionQuery = query(collectionRef);
    return from(getDocs(collectionQuery)).pipe(
      map((snapshot) =>
        snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as unknown as T[]
      )
    );
  }

  public getDocument<T extends DocumentData>(
    collectionName: FirebaseCollections,
    documentId: string
  ): Observable<T | undefined> {
    const collectionRef = collection(this.firestore, collectionName);
    const docRef = doc(collectionRef, documentId);
    return from(getDoc(docRef)).pipe(
      map((snapshot) => {
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
    const collectionRef = collection(this.firestore, collectionName) as CollectionReference<T, DocumentData>;
    return addDoc(collectionRef, document);
  }

  public updateDocument<T extends DocumentData>(
    collectionName: FirebaseCollections,
    documentId: string,
    document: UpdateData<T>
  ): Promise<void> {
    const collectionRef = collection(this.firestore, collectionName);
    const docRef = doc(collectionRef, documentId) as DocumentReference<T, DocumentData>;
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
}
