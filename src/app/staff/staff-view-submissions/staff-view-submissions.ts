import { Component, signal, Inject, PLATFORM_ID, OnInit } from '@angular/core';
import { isPlatformBrowser, CommonModule } from '@angular/common';
import { FirebaseService } from '../../services/firebaseservice';
import { FirebaseCollections } from '../../services/firebase-enums';
import { firstValueFrom } from 'rxjs';
import { StaffLayoutComponent } from '../staff-layout/staff-layout';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

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
  sendingReminders = signal(false);
  
  // Preview Signals
  showPreview = signal(false);
  previewUrl = signal<SafeResourceUrl | null>(null);
  previewType = signal<'pdf' | 'image' | 'docx'>('pdf');
  activeFileData = signal<string | null>(null);
  activeFileName = signal<string | null>(null);

  constructor(
    public firebaseService: FirebaseService,
    @Inject(PLATFORM_ID) private platformId: Object,
    private sanitizer: DomSanitizer
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

      if (!data || data.length === 0) {
        this.submissions.set([]);
        return;
      }

      // 🔍 Dynamic enrichment: Fetch missing emails and roll numbers from official records
      const enriched = await Promise.all(data.map(async (s) => {
        let updated = { ...s };
        // If email or roll number is missing, look it up
        if ((!s.studentEmail || !s.rollNo) && s.studentId) {
          try {
            // Try fetching from Registry first
            let student = await firstValueFrom(this.firebaseService.getDocument<any>(FirebaseCollections.Application, s.studentId));
            
            // Try fetching from official 'students' collection if needed
            if (!student || !student.rollNo) {
               const list = await firstValueFrom(this.firebaseService.getFilteredCollection<any>('students' as any, 'email', s.studentEmail?.trim().toLowerCase() || ''));
               if (list && list.length > 0) student = list[0];
            }

            if (student) {
              if (!updated.studentEmail && student.email) updated.studentEmail = student.email;
              if (!updated.rollNo && student.rollNo) updated.rollNo = student.rollNo;
            }
          } catch (err) {
            console.warn(`Data enrichment failed for student ID: ${s.studentId}`);
          }
        }
        return updated;
      }));

      this.submissions.set(enriched);
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

  viewFile(fileData: string, fileName: string) {
    if (!fileData) {
      alert('No file data available');
      return;
    }

    this.activeFileData.set(fileData);
    this.activeFileName.set(fileName);

    // 1. Detect MIME type
    const mimeMatch = fileData.match(/^data:(.*);base64,/);
    const mime = mimeMatch ? mimeMatch[1] : '';

    if (mime.includes('wordprocessingml') || mime.includes('msword') || mime.includes('officedocument')) {
      this.previewType.set('docx');
      alert("Word Documents (.docx) cannot be previewed directly. Please download to view.");
      // We still set a dummy or null to trigger the "can't preview" UI in modal
      this.previewUrl.set(null);
      this.showPreview.set(true);
      return;
    }

    if (mime.includes('image')) {
      this.previewType.set('image');
    } else {
      this.previewType.set('pdf');
    }

    // 2. Create Blob for reliable in-page preview (prevents about:blank issues)
    try {
      const base64 = fileData.split(',')[1];
      const binary = atob(base64);
      const array = [];
      for (let i = 0; i < binary.length; i++) {
        array.push(binary.charCodeAt(i));
      }
      const blob = new Blob([new Uint8Array(array)], { type: mime });
      const url = URL.createObjectURL(blob);
      
      this.previewUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(url));
      this.showPreview.set(true);
    } catch (e) {
      console.error("Preview Error:", e);
      alert("Failed to generate preview.");
    }
  }

  closePreview() {
    this.showPreview.set(false);
    this.previewUrl.set(null);
    this.activeFileData.set(null);
    this.activeFileName.set(null);
  }

  downloadCurrentFile() {
    const data = this.activeFileData();
    const name = this.activeFileName();
    if (!data) return;

    const link = document.createElement('a');
    link.href = data;
    link.download = name || 'submission';
    link.click();
  }

  async updateStatus(s: any, status: 'Approved' | 'Rejected') {
    if (!confirm(`Are you sure you want to ${status.toLowerCase()} this submission?`)) return;

    try {
      await this.firebaseService.updateDocument(
        FirebaseCollections.assignment_submissions,
        s.id,
        { status: status }
      );

      // Notify student via email
      if (s.studentEmail) {
        const payload = {
          to: s.studentEmail,
          subject: status === 'Approved' ? `Assignment Approved: ${this.selectedAssignment().title}` : `Re-submission Required: ${this.selectedAssignment().title}`,
          studentName: s.studentName,
          assignmentTitle: this.selectedAssignment().title,
          type: status === 'Approved' ? 'submission_approved' : 'submission_rejected'
        };
        await this.firebaseService.sendEmail(payload);
      }

      alert(`Submission ${status} & Email sent!`);

      // UI Update
      const list = this.submissions().map(sub => sub.id === s.id ? { ...sub, status } : sub);
      this.submissions.set(list);

    } catch (e) {
      console.error(e);
      alert("Error updating status");
    }
  }
}