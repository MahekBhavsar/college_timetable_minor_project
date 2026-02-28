import { Component, OnInit, signal, Inject, PLATFORM_ID, computed } from '@angular/core';
import { isPlatformBrowser, CommonModule } from '@angular/common';
import { FirebaseService } from '../../services/firebaseservice';
import { FirebaseCollections } from '../../services/firebase-enums';
import { SafePipe } from '../../safe-pipe'; 
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-staff-manage-student',
  standalone: true,
  imports: [CommonModule, SafePipe, FormsModule], 
  templateUrl: './staff-manage-students.html'
})
export class StaffManageStudent implements OnInit {
  students = signal<any[]>([]);
  staffSemesters = signal<number[]>([]); 
  selectedSemester = signal<number>(1); // Default view
  availableSemesters = [1, 2, 3, 4, 5, 6]; 

  // These update AUTOMATICALLY when you change the dropdown
  pendingStudents = computed(() => 
    this.students().filter(s => s.status === 'pending' && Number(s.semester) === Number(this.selectedSemester()))
  );

  approvedRecords = computed(() => 
    this.students().filter(s => s.status === 'Application approved by staff' && Number(s.semester) === Number(this.selectedSemester()))
  );

  constructor(
    private firebaseService: FirebaseService, 
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      const userData = localStorage.getItem('portal_user');
      const staff = JSON.parse(userData || '{}');

      // Keep track of what this staff is assigned to, but allow them to see all
      if (staff.semesters && Array.isArray(staff.semesters)) {
        this.staffSemesters.set(staff.semesters.map((s: any) => Number(s)));
      }
      
      this.loadAllData();
    }
  }

  loadAllData() {
    this.firebaseService.getCollection<any>(FirebaseCollections.Application).subscribe(data => {
      this.students.set(data); // Store everything; filtering happens in computed signals
    });
  }

  viewDocument(student: any) {
    const data = student.document || student.verificationDocBase64 || student.verificationDocUrl;
    if (!data) {
      alert("No document data found.");
      return;
    }

    const newTab = window.open();
    if (newTab) {
      const content = data.includes('pdf') 
        ? `<iframe src="${data}" width="100%" height="100%" style="border:none;"></iframe>`
        : `<img src="${data}" style="max-width:100%; margin:auto; display:block;">`;
      newTab.document.write(`<body style="margin:0;background:#222;display:flex;justify-content:center;align-items:center;min-height:100vh;">${content}</body>`);
      newTab.document.close();
    }
  }

  async verify(student: any) {
    if(!confirm(`Approve ${student.name}?`)) return;
    try {
      await this.firebaseService.updateDocument(FirebaseCollections.Application, student.id, {
        status: 'Application approved by staff'
      });
      
      const studentData = {
        ...student,
        status: 'Application approved by staff',
        approvedAt: new Date().toISOString()
      };
      
      await this.firebaseService.addDocument('students' as any, studentData);
      await this.firebaseService.sendApprovalEmail(student.email, student.name);
      
      alert("Verified!");
      this.loadAllData(); // Refresh list to reflect changes
    } catch (error) {
      alert("Error processing approval.");
    }
  }
}