import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Firestore } from '@angular/fire/firestore';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {

  protected readonly title = signal('college-planner-timetable-system');
  protected readonly firebaseStatus = signal('Connecting to Firebase...');

  constructor(private firestore: Firestore) {
    this.checkFirebase();
  }

  async checkFirebase() {
    try {
      await this.firestore.app.options;
      this.firebaseStatus.set('🔥 Firebase Connected Successfully');
    } catch (e) {
      this.firebaseStatus.set('❌ Firebase Connection Failed');
      console.error(e);
    }
  }
}
