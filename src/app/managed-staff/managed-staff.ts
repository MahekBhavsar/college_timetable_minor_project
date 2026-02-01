import { Component, signal, OnInit, inject, computed, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FirebaseService } from '../services/firebaseservice';
import { FirebaseCollections } from '../services/firebase-enums';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-manage-staff',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './managed-staff.html',
  styleUrls: ['./managed-staff.css'] // I will provide this below
})
export class ManageStaff implements OnInit, OnDestroy {
  private fb = inject(FirebaseService);
  private sub = new Subscription();

  // --- SIGNALS ---
  staffList = signal<any[]>([]);
  availableSubjects = signal<any[]>([]);
  selectedSubjectIds = signal<string[]>([]);
  selectedSemester = signal<number>(1);
  editingId = signal<string | null>(null);

  newStaff = signal({
    name: '',
    email: '',
    password: '', // 🟢 NEW
    semester: 1
  });

  // --- COMPUTED ---
  // This combines staff data with subject names for the table
  enrichedStaff = computed(() => {
    const subjects = this.availableSubjects();
    return this.staffList().map(staff => ({
      ...staff,
      displaySubjects: (staff.subjectIds || []).map((id: string) => 
        subjects.find(sub => sub.id === id)?.name || 'Unknown'
      )
    }));
  });

  ngOnInit() {
    this.sub.add(this.fb.getCollection(FirebaseCollections.Staff).subscribe(data => this.staffList.set(data)));
    this.sub.add(this.fb.getCollection(FirebaseCollections.Subjects).subscribe(data => this.availableSubjects.set(data)));
  }

  updateStaffField(field: 'name' | 'email' | 'password', value: string) {
    this.newStaff.set({ ...this.newStaff(), [field]: value });
  }

  toggleSubject(subjectId: string) {
    const current = this.selectedSubjectIds();
    if (current.includes(subjectId)) {
      this.selectedSubjectIds.set(current.filter(id => id !== subjectId));
    } else {
      this.selectedSubjectIds.set([...current, subjectId]);
    }
  }

  async saveStaff() {
    const staff = this.newStaff();
    if (!staff.name || !staff.email || !staff.password) {
      return alert('All fields including Password are required');
    }

    const payload = {
      ...staff,
      role: 'staff', // 🟢 This allows them to use the common login page
      semester: this.selectedSemester(),
      subjectIds: this.selectedSubjectIds(),
      updatedAt: new Date()
    };

    try {
      if (this.editingId()) {
        await this.fb.updateDocument(FirebaseCollections.Staff, this.editingId()!, payload);
        alert('Staff updated successfully');
      } else {
        await this.fb.addDocument(FirebaseCollections.Staff, payload);
        alert('Staff account created with password');
      }
      this.cancelAction();
    } catch (err) {
      alert('Error saving staff member');
    }
  }

  editStaff(staff: any) {
    this.editingId.set(staff.id);
    this.selectedSemester.set(staff.semester || 1);
    this.selectedSubjectIds.set([...(staff.subjectIds || [])]);
    this.newStaff.set({
      name: staff.name,
      email: staff.email,
      password: staff.password || '', // 🟢 Load the password
      semester: staff.semester || 1
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async deleteStaff(id: string) {
    if (confirm('Delete this faculty account?')) {
      await this.fb.deleteDocument(FirebaseCollections.Staff, id);
    }
  }

  cancelAction() {
    this.editingId.set(null);
    this.selectedSubjectIds.set([]);
    this.selectedSemester.set(1);
    this.newStaff.set({ name: '', email: '', password: '', semester: 1 });
  }

  ngOnDestroy() { this.sub.unsubscribe(); }
}