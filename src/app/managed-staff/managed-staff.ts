import { Component, signal, OnInit, inject, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FirebaseService } from '../services/firebaseservice';
import { FirebaseCollections } from '../services/firebase-enums';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-manage-staff',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './managed-staff.html'
})
export class ManageStaff implements OnInit, OnDestroy {
  private fb = inject(FirebaseService);
  private sub = new Subscription();

  // --- SIGNALS ---
  staffList = signal<any[]>([]);
  selectedSemesters = signal<number[]>([]); 
  editingId = signal<string | null>(null);

  newStaff = signal({
    name: '',
    email: '',
    password: '', 
  });

  ngOnInit() {
    // Only fetch staff list now
    this.sub.add(this.fb.getCollection(FirebaseCollections.Staff).subscribe(data => {
      this.staffList.set(data);
    }));
  }

  toggleSemester(sem: number) {
    const current = this.selectedSemesters();
    if (current.includes(sem)) {
      this.selectedSemesters.set(current.filter(s => s !== sem));
    } else {
      this.selectedSemesters.set([...current, sem].sort());
    }
  }

  updateStaffField(field: 'name' | 'email' | 'password', value: string) {
    this.newStaff.set({ ...this.newStaff(), [field]: value });
  }

  async saveStaff() {
    const staff = this.newStaff();
    if (!staff.name || !staff.email || !staff.password || this.selectedSemesters().length === 0) {
      return alert('All fields and at least one Semester are required');
    }

    const payload = {
      ...staff,
      role: 'staff',
      semesters: this.selectedSemesters(), 
      updatedAt: new Date()
    };

    try {
      if (this.editingId()) {
        await this.fb.updateDocument(FirebaseCollections.Staff, this.editingId()!, payload);
        alert('Staff updated successfully');
      } else {
        await this.fb.addDocument(FirebaseCollections.Staff, payload);
        alert('Staff account created');
      }
      this.cancelAction();
    } catch (err) {
      alert('Error saving staff member');
    }
  }

  editStaff(staff: any) {
    this.editingId.set(staff.id);
    // Handle migration from single semester to multiple
    const sems = staff.semesters ? [...staff.semesters] : (staff.semester ? [staff.semester] : []);
    this.selectedSemesters.set(sems);
    
    this.newStaff.set({
      name: staff.name,
      email: staff.email,
      password: staff.password || '',
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
    this.selectedSemesters.set([]); 
    this.newStaff.set({ name: '', email: '', password: '' });
  }

  ngOnDestroy() { this.sub.unsubscribe(); }
}