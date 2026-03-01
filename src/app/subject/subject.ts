import { Component, OnInit, signal, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminLayoutComponent } from '../admin-layout/admin-layout';
import { FirebaseService } from '../services/firebaseservice';
import { FirebaseCollections } from '../services/firebase-enums';

@Component({
  selector: 'app-subject',
  standalone: true,
  imports: [CommonModule, FormsModule, AdminLayoutComponent],
  templateUrl: './subject.html',
  styles: [`
    .badge-major { background: #e0e7ff; color: #4338ca; padding: 4px 10px; border-radius: 6px; font-weight: 600; font-size: 11px; }
    .badge-minor { background: #fef3c7; color: #92400e; padding: 4px 10px; border-radius: 6px; font-weight: 600; font-size: 11px; }
    .hover-row:hover { background-color: #f8f9fa; transition: 0.2s; }
    .btn-icon { border: none; background: transparent; padding: 5px 10px; border-radius: 5px; cursor: pointer; }
    .btn-icon:hover { background: #e9ecef; }
    .extra-small { font-size: 0.75rem; }
  `]
})
export class Subject implements OnInit {
  public fb = inject(FirebaseService);

  subjects = signal<any[]>([]);
  staffList = signal<any[]>([]);
  editingId = signal<string | null>(null);
  semesterNumbers = [1, 2, 3, 4, 5, 6];

  // Group subjects by semester for the list view
  groupedSubjects = computed(() => {
    const grouped: { [key: number]: any[] } = {};
    this.semesterNumbers.forEach(sem => grouped[sem] = []);
    this.subjects().forEach(sub => {
      if (grouped[sub.semester]) grouped[sub.semester].push(sub);
    });
    return grouped;
  });

  newSubject: any = {
    name: '',
    semester: 4,
    type: 'Major',
    credits: 4,
    lectureCount: 3,
    labCount: 2,
    course: 'BCA',
    department: 'BCA', // 🔥 BCA, Mathematics, or Communication
    divisionStaff: { A: '', B: '', C: '' },
    allowedDivisions: ['A', 'B', 'C']
  };

  ngOnInit() {
    this.loadSubjects();
    this.loadStaff();
  }

  loadSubjects() {
    this.fb.getCollection<any>(FirebaseCollections.Subjects).subscribe(data => this.subjects.set(data));
  }

  loadStaff() {
    this.fb.getCollection<any>(FirebaseCollections.Staff).subscribe(data => this.staffList.set(data));
  }

  getStaffName(id: string): string {
    const staff = this.staffList().find(s => s.id === id);
    return staff ? staff.name : 'Not Assigned';
  }

  editSubject(subject: any) {
    this.editingId.set(subject.id);
    this.newSubject = {
      ...subject,
      divisionStaff: subject.divisionStaff || { A: '', B: '', C: '' },
      allowedDivisions: subject.allowedDivisions || ['A', 'B', 'C']
    };
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async saveSubject() {
    if (!this.newSubject.name.trim()) return;

    const nameLower = this.newSubject.name.toLowerCase();
    const typeUpper = this.newSubject.type.toUpperCase();

    // 🔥 STRICT RULE: Math, Communication, AEC, SEC, VAC strictly DO NOT have labs
    const restrictedTypes = ['AEC', 'SEC', 'VAC'];
    const isSpecialized = nameLower.includes('math') || nameLower.includes('comm');

    if (restrictedTypes.includes(typeUpper) || isSpecialized) {
      this.newSubject.labCount = 0;
    }

    const subjectData = {
      ...this.newSubject,
      semester: Number(this.newSubject.semester),
      lectureCount: Number(this.newSubject.lectureCount),
      labCount: Number(this.newSubject.labCount),
      totalWeeklySlots: Number(this.newSubject.lectureCount) + Number(this.newSubject.labCount),
      allowedDivisions: this.newSubject.allowedDivisions?.length ? this.newSubject.allowedDivisions : ['A', 'B', 'C']
    };

    try {
      if (this.editingId()) {
        await this.fb.updateDocument(FirebaseCollections.Subjects, this.editingId()!, subjectData);
        this.editingId.set(null);
      } else {
        await this.fb.addDocument(FirebaseCollections.Subjects, subjectData);
      }
      this.resetForm();
    } catch (error) {
      console.error("Save failed", error);
    }
  }

  resetForm() {
    this.newSubject = {
      name: '',
      semester: 4,
      type: 'Major',
      credits: 4,
      lectureCount: 3,
      labCount: 2,
      course: 'BCA',
      department: 'BCA',
      divisionStaff: { A: '', B: '', C: '' },
      allowedDivisions: ['A', 'B', 'C']
    };
  }

  async deleteSubject(id: string) {
    if (confirm('Delete this subject?')) {
      await this.fb.deleteDocument(FirebaseCollections.Subjects, id);
    }
  }

  cancelEdit() {
    this.editingId.set(null);
    this.resetForm();
  }

  toggleDivision(div: string, event: any) {
    if (event.target.checked) {
      if (!this.newSubject.allowedDivisions.includes(div)) this.newSubject.allowedDivisions.push(div);
    } else {
      this.newSubject.allowedDivisions = this.newSubject.allowedDivisions.filter((d: string) => d !== div);
    }
  }
}