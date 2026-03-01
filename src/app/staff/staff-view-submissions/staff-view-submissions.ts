import { Component, signal, Inject, PLATFORM_ID, OnInit } from '@angular/core';
import { isPlatformBrowser, CommonModule } from '@angular/common';
import { FirebaseService } from '../../services/firebaseservice';
import { FirebaseCollections } from '../../services/firebase-enums';
import { firstValueFrom } from 'rxjs';
import { StaffLayoutComponent } from '../staff-layout/staff-layout';

@Component({
  selector: 'app-staff-view-submissions',
  standalone: true,
  imports: [CommonModule, StaffLayoutComponent],
  templateUrl: './staff-view-submissions.html'
})
export class StaffViewSubmissions implements OnInit {

  staff = signal<any>(null);
  assignments = signal<any[]>([]);
  selectedAssignment = signal<any>(null);
  submissions = signal<any[]>([]);

  // Controls
  loading = signal(true);
  sendingReminders = signal(false); // Added missing signal

  constructor(
    public firebaseService: FirebaseService, // Changed to public for template access
    @Inject(PLATFORM_ID) private platformId: Object
  ) { }

  async ngOnInit() {
    if (!isPlatformBrowser(this.platformId)) return;

    const stored = localStorage.getItem('portal_user');
    if (!stored) return;

    try {
      this.staff.set(JSON.parse(stored));
      await this.loadAssignments();
    } catch (e) {
      console.error("Error parsing user data", e);
    }
  }

  async loadAssignments() {
    this.loading.set(true);
    try {
      const data = await firstValueFrom(
        this.firebaseService.getFilteredCollection<any>(
          FirebaseCollections.assignments,
          'staffName',
          this.staff().name
        )
      );
      this.assignments.set(data || []);
    } catch (error) {
      console.error("Error loading assignments:", error);
    } finally {
      this.loading.set(false);
    }
  }

  async openAssignment(a: any) {
    this.selectedAssignment.set(a);
    this.submissions.set([]);

    try {
      const data = await firstValueFrom(
        this.firebaseService.getFilteredCollection<any>(
          FirebaseCollections.assignment_submissions,
          'assignmentId',
          a.id
        )
      );
      this.submissions.set(data || []);
    } catch (error) {
      console.error("Error loading submissions:", error);
    }
  }

  // Added missing method for the 3-day reminder
  // src/app/staff/staff-view-submissions/staff-view-submissions.ts

  async sendManualReminders() {
    this.sendingReminders.set(true);
    try {
      // This method already contains the alert() logic for success/no-data
      await this.firebaseService.checkAndSendReminders();

      // REMOVED THE alert() FROM HERE TO PREVENT DOUBLE POPUPS
    } catch (error) {
      console.error("Reminder error:", error);
      alert('Failed to send reminders.');
    } finally {
      this.sendingReminders.set(false);
    }
  }

  viewFile(fileData: string) {
    if (!fileData) {
      alert('No file data available');
      return;
    }
    const win = window.open();
    if (win) {
      win.document.write(`<iframe src="${fileData}" frameborder="0" style="border:0; width:100%; height:100%;" allowfullscreen></iframe>`);
    }
  }
}