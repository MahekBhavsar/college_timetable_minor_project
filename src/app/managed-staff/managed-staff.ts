import { Component, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FirebaseService } from '../services/firebaseservice';
import { FirebaseCollections } from '../services/firebase-enums';

@Component({
  selector: 'app-manage-staff',
  standalone: true,
  imports: [FormsModule], // Only FormsModule is needed for [(ngModel)]
  templateUrl: './managed-staff.html',
  styleUrls: ['./managed-staff.css']
})
export class ManageStaff implements OnInit {
  staffList = signal<any[]>([]);
  subjectInput = '';
  editingId = signal<string | null>(null);

  newStaff = {
    name: '',
    email: '',
    semesters: [] as number[],
    subjects: [] as string[]
  };

  constructor(private fb: FirebaseService) {}

  ngOnInit() {
    this.loadStaff();
  }

  loadStaff() {
    this.fb.getCollection<any>(FirebaseCollections.Staff).subscribe(data => {
      this.staffList.set(data);
    });
  }

  editStaff(staff: any) {
    this.editingId.set(staff.id);
    this.newStaff = {
      name: staff.name,
      email: staff.email,
      semesters: [...staff.semesters],
      subjects: [...staff.subjects]
    };
    this.subjectInput = staff.subjects.join(', ');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  toggleSem(sem: number) {
    if (this.newStaff.semesters.includes(sem)) {
      this.newStaff.semesters = this.newStaff.semesters.filter(s => s !== sem);
    } else {
      this.newStaff.semesters.push(sem);
      this.newStaff.semesters.sort();
    }
  }

  async saveStaff() {
    if (this.subjectInput) {
      this.newStaff.subjects = this.subjectInput.split(',').map(s => s.trim()).filter(s => s !== '');
    }

    try {
      if (this.editingId()) {
        await this.fb.updateDocument(FirebaseCollections.Staff, this.editingId()!, this.newStaff);
      } else {
        await this.fb.addDocument(FirebaseCollections.Staff, this.newStaff);
      }
      this.loadStaff();
      this.cancelAction();
    } catch (error) {
      console.error("Save failed", error);
    }
  }

  cancelAction() {
    this.newStaff = { name: '', email: '', semesters: [], subjects: [] };
    this.subjectInput = '';
    this.editingId.set(null);
  }

  async deleteStaff(id: string) {
    if (confirm('Delete this faculty member?')) {
      await this.fb.deleteDocument(FirebaseCollections.Staff, id);
      this.loadStaff();
    }
  }
}