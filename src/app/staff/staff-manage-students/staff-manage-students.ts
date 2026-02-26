import { Component, OnInit, signal, Inject, PLATFORM_ID, computed } from '@angular/core';
import { isPlatformBrowser, CommonModule } from '@angular/common';
import { FirebaseService } from '../../services/firebaseservice';
import { FirebaseCollections } from '../../services/firebase-enums';
import { SafePipe } from '../../safe-pipe'; //

@Component({
  selector: 'app-staff-manage-student',
  standalone: true,
  imports: [CommonModule, SafePipe], //
  templateUrl: './staff-manage-students.html'
})
export class StaffManageStudent implements OnInit {
  students = signal<any[]>([]);
  staffSem = signal<number>(0);
  selectedDoc = signal<string | null>(null);

  pendingStudents = computed(() => 
    this.students().filter(s => s.status === 'pending')
  );

  approvedRecords = computed(() => 
    this.students().filter(s => s.status === 'Application approved by staff')
  );

  constructor(
    private firebaseService: FirebaseService, 
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      const staff = JSON.parse(localStorage.getItem('portal_user') || '{}');
      this.staffSem.set(Number(staff.semester));
      this.loadMyStudents();
    }
  }

  loadMyStudents() {
    this.firebaseService.getCollection<any>(FirebaseCollections.Application).subscribe(data => {
      const filtered = data.filter(s => Number(s.semester) === this.staffSem());
      const sorted = filtered.sort((a, b) => {
        const valA = a.appliedAt || ''; 
        const valB = b.appliedAt || '';
        return valB.localeCompare(valA);
      });
      this.students.set(sorted);
    });
  }

  viewDocument(base64Data: string) {
    if (!base64Data || base64Data.length < 500) {
      alert("Error: Document data is missing or invalid.");
      return;
    }

    // 1. Handle Word Documents (DOCX) via Download
    if (base64Data.includes('officedocument.wordprocessingml.document')) {
      const link = document.createElement('a');
      link.href = base64Data;
      link.download = `student_verification_${Date.now()}.docx`;
      link.click();
      return;
    }

    // 2. Set the signal for the modal preview
    this.selectedDoc.set(base64Data);

    // 3. Open in New Tab for better visibility
    const newTab = window.open();
    if (newTab) {
      let content = '';
      if (base64Data.includes('pdf')) {
        content = `<iframe src="${base64Data}" width="100%" height="100%" style="border:none;"></iframe>`;
      } else {
        content = `<img src="${base64Data}" style="max-width:100%; max-height:100vh; object-fit:contain;">`;
      }

      newTab.document.write(`
        <body style="margin:0; background:#222; display:flex; justify-content:center; align-items:center; height:100vh;">
          ${content}
        </body>
      `);
      newTab.document.close();
    }
  }

  async verify(student: any) {
    if(!confirm(`Are you sure you want to approve ${student.name}?`)) return;
    try {
      await this.firebaseService.updateDocument(FirebaseCollections.Application, student.id, {
        status: 'Application approved by staff'
      });
      const studentData = {
        applicationId: student.id,
        name: student.name,
        email: student.email,
        semester: student.semester,
        division: student.division || 'A',
        approvedAt: new Date().toISOString(),
        role: 'student'
      };
      await this.firebaseService.addDocument('students' as any, studentData);
      await this.firebaseService.sendApprovalEmail(student.email, student.name);
      alert(`${student.name} approved and moved to registry!`);
    } catch (error) {
      alert("Error approving student.");
    }
  }

  closePreview() {
    this.selectedDoc.set(null);
  }
}