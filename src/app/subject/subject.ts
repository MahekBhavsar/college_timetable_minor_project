import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FirebaseService } from '../services/firebaseservice';
import { FirebaseCollections } from '../services/firebase-enums';

@Component({
  selector: 'app-subject',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './subject.html',
  styles: [`
    .badge-major { background: #e0e7ff; color: #4338ca; padding: 4px 10px; border-radius: 6px; font-weight: 600; font-size: 11px; }
    .badge-minor { background: #fef3c7; color: #92400e; padding: 4px 10px; border-radius: 6px; font-weight: 600; font-size: 11px; }
    .avatar-blue { width: 32px; height: 32px; background: #0d6efd; color: white; border-radius: 8px; 
                   display: flex; align-items: center; justify-content: center; font-weight: bold; }
    .hover-row:hover { background-color: #f8f9fa; transition: 0.2s; }
    .btn-icon { border: none; background: transparent; padding: 5px 10px; border-radius: 5px; }
    .btn-icon:hover { background: #e9ecef; }
    .extra-small { font-size: 0.75rem; }
  `]
})
export class Subject implements OnInit {
  public fb = inject(FirebaseService);
  
  subjects = signal<any[]>([]);
  staffList = signal<any[]>([]);
  editingId = signal<string | null>(null);
  
  // Rule: Define divisionStaff with an index signature to fix TS7053 indexing errors
  newSubject: {
    name: string;
    semester: number;
    type: string;
    credits: number;
    lectureCount: number;
    labCount: number;
    course: string;
    divisionStaff: { [key: string]: string }; 
  } = {
    name: '',
    semester: 1,
    type: 'Major',
    credits: 4,
    lectureCount: 3,
    labCount: 1,
    course: 'BCA',
    divisionStaff: { A: '', B: '', C: '' } 
  };

  ngOnInit() { 
    this.loadSubjects(); 
    this.loadStaff(); 
  }

  loadSubjects() {
    this.fb.getCollection<any>(FirebaseCollections.Subjects).subscribe(data => {
      // Sort subjects numerically by semester
      this.subjects.set(data.sort((a, b) => Number(a.semester) - Number(b.semester)));
    });
  }

  loadStaff() {
    this.fb.getCollection<any>(FirebaseCollections.Staff).subscribe(data => {
      this.staffList.set(data);
    });
  }

  // Helper to find staff name for the table display
  getStaffName(id: string): string {
    const staff = this.staffList().find(s => s.id === id);
    return staff ? staff.name : 'Not Assigned';
  }

  editSubject(subject: any) {
    this.editingId.set(subject.id);
    this.newSubject = { 
      ...subject,
      semester: Number(subject.semester),
      credits: Number(subject.credits),
      lectureCount: Number(subject.lectureCount),
      labCount: Number(subject.labCount),
      divisionStaff: subject.divisionStaff || { A: '', B: '', C: '' }
    };
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  cancelEdit() {
    this.editingId.set(null);
    this.resetForm();
  }

  async saveSubject() {
    if (!this.newSubject.name.trim()) return;

    const subjectData = {
      ...this.newSubject,
      name: this.newSubject.name.trim(),
      semester: Number(this.newSubject.semester),
      totalWeeklySlots: Number(this.newSubject.lectureCount) + Number(this.newSubject.labCount)
    };

    try {
      if (this.editingId()) {
        await this.fb.updateDocument(FirebaseCollections.Subjects, this.editingId()!, subjectData);
        this.editingId.set(null);
      } else {
        await this.fb.addDocument(FirebaseCollections.Subjects, subjectData);
      }
      this.resetForm();
      this.loadSubjects();
    } catch (error) {
      console.error("Operation failed", error);
    }
  }

  resetForm() {
    this.newSubject = { 
      name: '', semester: 1, type: 'Major', credits: 4, 
      lectureCount: 3, labCount: 1, course: 'BCA',
      divisionStaff: { A: '', B: '', C: '' }
    };
  }

  async deleteSubject(id: string) {
    if (confirm('Are you sure you want to delete this subject?')) {
      await this.fb.deleteDocument(FirebaseCollections.Subjects, id);
      this.loadSubjects();
    }
  }
}