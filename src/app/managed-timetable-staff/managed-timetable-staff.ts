import { Component, signal, OnInit, inject, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FirebaseService } from '../services/firebaseservice';
import { FirebaseCollections } from '../services/firebase-enums';
import { AdminLayoutComponent } from '../admin-layout/admin-layout';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-managed-timetable-staff',
  standalone: true,
  imports: [CommonModule, FormsModule, AdminLayoutComponent],
  templateUrl: './managed-timetable-staff.html',
  styleUrl: './managed-timetable-staff.css',
})
export class ManagedTimetableStaff implements OnInit, OnDestroy {
  private fb = inject(FirebaseService);
  private sub = new Subscription();

  staffList = signal<any[]>([]);
  preferencesList = signal<any[]>([]);
  
  selectedStaffId = signal<string>('');
  selectedSem = signal<number | null>(null);

  // Buffer for editing times
  globalStartTime = signal<string>('09:00');
  globalEndTime = signal<string>('17:00');
  
  startTime = signal<string>('09:00');
  endTime = signal<string>('17:00');

  ngOnInit() {
    this.sub.add(this.fb.getCollection(FirebaseCollections.Staff).subscribe(data => {
      this.staffList.set(data);
    }));
    this.sub.add(this.fb.getCollection(FirebaseCollections.StaffPreferences).subscribe(data => {
      this.preferencesList.set(data);
      this.loadGlobalPrefs();
    }));
  }

  loadGlobalPrefs() {
    if (!this.selectedStaffId()) return;
    const staffPref = this.preferencesList().find(p => p.staffId === this.selectedStaffId());
    if (staffPref?.global) {
      this.globalStartTime.set(staffPref.global.startTime || '09:00');
      this.globalEndTime.set(staffPref.global.endTime || '17:00');
    } else {
      this.globalStartTime.set('09:00');
      this.globalEndTime.set('17:00');
    }
  }

  get selectedStaff() {
    return this.staffList().find(s => s.id === this.selectedStaffId());
  }

  isSemAssigned(sem: number): boolean {
    const staff = this.selectedStaff;
    if (!staff) return false;
    const sems = staff.semesters || (staff.semester ? [staff.semester] : []);
    return sems.includes(sem);
  }

  selectSem(sem: number) {
    if (!this.isSemAssigned(sem)) return;
    this.selectedSem.set(sem);
    
    // Load existing preference if any
    const staffPref = this.preferencesList().find(p => p.staffId === this.selectedStaffId());
    if (staffPref && staffPref.preferences && staffPref.preferences[sem]) {
      this.startTime.set(staffPref.preferences[sem].startTime);
      this.endTime.set(staffPref.preferences[sem].endTime);
    } else {
      // Default to global times if available, else standard
      this.startTime.set(this.globalStartTime());
      this.endTime.set(this.globalEndTime());
    }
  }

  async saveGlobalPreference() {
    if (!this.selectedStaffId()) return;
    const staffId = this.selectedStaffId();
    const existing = this.preferencesList().find(p => p.staffId === staffId);

    const globalPref = { startTime: this.globalStartTime(), endTime: this.globalEndTime() };

    try {
      if (existing) {
        await this.fb.updateDocument(FirebaseCollections.StaffPreferences, existing.id, {
          global: globalPref,
          updatedAt: new Date()
        });
      } else {
        await this.fb.addDocument(FirebaseCollections.StaffPreferences, {
          staffId,
          global: globalPref,
          preferences: {},
          updatedAt: new Date()
        });
      }
      alert('General availability saved!');
    } catch (err) {
      console.error(err);
      alert('Error saving global preference');
    }
  }

  async savePreference() {
    if (!this.selectedStaffId() || this.selectedSem() === null) return;

    const staffId = this.selectedStaffId();
    const sem = this.selectedSem()!;
    const existing = this.preferencesList().find(p => p.staffId === staffId);

    const newPref = {
      startTime: this.startTime(),
      endTime: this.endTime()
    };

    try {
      if (existing) {
        const updatedPrefs = { ...existing.preferences, [sem]: newPref };
        await this.fb.updateDocument(FirebaseCollections.StaffPreferences, existing.id, {
          preferences: updatedPrefs,
          updatedAt: new Date()
        });
      } else {
        await this.fb.addDocument(FirebaseCollections.StaffPreferences, {
          staffId,
          global: { startTime: '09:00', endTime: '17:00' },
          preferences: { [sem]: newPref },
          updatedAt: new Date()
        });
      }
      alert('Semester preference saved!');
    } catch (err) {
      console.error(err);
      alert('Error saving preference');
    }
  }

  getPrefForSem(staffId: string, sem: number) {
    const pref = this.preferencesList().find(p => p.staffId === staffId);
    return pref?.preferences?.[sem];
  }

  ngOnDestroy() {
    this.sub.unsubscribe();
  }
}

