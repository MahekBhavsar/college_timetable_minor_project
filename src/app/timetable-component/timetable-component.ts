import { Component, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { FirebaseService } from '../services/firebaseservice';
import { FirebaseCollections } from '../services/firebase-enums';

@Component({
  selector: 'app-timetable',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './timetable-component.html',
  styles: [`
    .modal.show { display: block; background: rgba(0,0,0,0.6); z-index: 1050; backdrop-filter: blur(4px); }
    .slot-cell { cursor: pointer; transition: 0.2s; min-height: 100px; vertical-align: top; border: 1px solid #f0f0f0 !important; }
    .slot-cell:hover { background-color: #f8f9fa !important; }
    .time-col { background-color: #f1f3f5 !important; color: #495057 !important; font-weight: 700; width: 120px; font-size: 0.85rem; }
    .recess-row { background-color: #fff3cd !important; font-weight: bold; color: #856404; letter-spacing: 5px; text-transform: uppercase; }
    .timetable-card { border-radius: 15px; border: none; overflow: hidden; }
    .time-input { width: 70px; border: 1px solid #dee2e6; border-radius: 6px; padding: 4px 8px; font-weight: bold; text-align: center; }
  `]
})
export class TimetableComponent implements OnInit {
  userRole = signal<'staff' | 'student'>('staff');
  viewMode = signal<'class' | 'staff'>('class');
  selectedSem = signal<number>(1);
  selectedDiv = signal<string>('A');
  selectedStaffId = signal<string>('');
  isGenerating = signal<boolean>(false);

  // Manual Time Settings (In Hours)
  startTime = signal<number>(8); 
  endTime = signal<number>(17);  

  showEditModal = signal<boolean>(false);
  editingSlot = signal<any>(null);
  
  staffList = signal<any[]>([]);
  allSlots = signal<any[]>([]);
  days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  constructor(private fb: FirebaseService) {}

  ngOnInit() { this.loadData(); }

  loadData() {
    this.fb.getCollection<any>(FirebaseCollections.Staff).subscribe(data => this.staffList.set(data));
    this.fb.getCollection<any>(FirebaseCollections.Timetable).subscribe(data => this.allSlots.set(data));
  }

  // --- 50 MINUTE LECTURE + 1:30 RECESS LOGIC ---
  get currentTimeSlots() {
    const slots: string[] = [];
    let currentMins = this.startTime() * 60;
    const endMins = this.endTime() * 60;

    while (currentMins + 50 <= endMins) {
      // 13:30 = 810 minutes (1:30 PM)
      if (currentMins === 810) {
        slots.push("RECESS");
        currentMins += 30; // 30 min break until 14:00
        continue;
      }

      const h = Math.floor(currentMins / 60);
      const m = currentMins % 60;
      slots.push(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`);
      currentMins += 50;
    }
    return slots;
  }

  get filteredSlots() {
    const all = this.allSlots();
    if (this.viewMode() === 'staff') return all.filter(s => s.staffId === this.selectedStaffId());
    return all.filter(s => s.sem == this.selectedSem() && s.div === this.selectedDiv());
  }

  openEdit(day: string, time: string) {
    if (this.userRole() !== 'staff' || time === 'RECESS') return;
    const existing = this.filteredSlots.find(s => s.day === day && s.time === time);
    
    this.editingSlot.set(existing ? { ...existing } : {
      day, time, sem: this.selectedSem(), div: this.selectedDiv(),
      staffId: '', staffName: '', subject: '', type: 'Lecture'
    });
    this.showEditModal.set(true);
  }

  onStaffChange(staffId: string) {
    const staff = this.staffList().find(s => s.id === staffId);
    if (staff) {
      this.editingSlot.update(val => ({ ...val, staffId: staff.id, staffName: staff.name, subject: staff.subjects[0] }));
    }
  }

  async saveSlot() {
    const slot = this.editingSlot();
    if (!slot.staffId) return alert("Select a teacher!");

    // Prevent manual conflict
    const isBusy = this.allSlots().some(s => 
      s.id !== slot.id && s.day === slot.day && s.time === slot.time && s.staffId === slot.staffId
    );

    if (isBusy) return alert(`Conflict: This teacher is already teaching another class at ${slot.time}`);

    slot.id ? await this.fb.updateDocument(FirebaseCollections.Timetable, slot.id, slot) 
            : await this.fb.addDocument(FirebaseCollections.Timetable, slot);
    this.showEditModal.set(false);
    this.loadData();
  }

  async generateTimetable() {
    if (!confirm(`Auto-fill for Sem ${this.selectedSem()} Div ${this.selectedDiv()}?`)) return;
    this.isGenerating.set(true);
    let tempSlots = [...this.allSlots()];

    for (const day of this.days) {
      for (const time of this.currentTimeSlots) {
        if (time === "RECESS") continue;

        const isOccupied = tempSlots.some(s => s.day === day && s.time === time && s.sem == this.selectedSem() && s.div === this.selectedDiv());
        
        if (!isOccupied) {
          // Conflict Prevention: Find staff free at this specific time across ALL classes
          const freeStaff = this.staffList().find(staff => 
            !tempSlots.some(s => s.day === day && s.time === time && s.staffId === staff.id)
          );

          if (freeStaff) {
            const newDoc = {
              day, time, sem: this.selectedSem(), div: this.selectedDiv(),
              staffId: freeStaff.id, staffName: freeStaff.name, subject: freeStaff.subjects[0], type: 'Lecture'
            };
            const res = await this.fb.addDocument(FirebaseCollections.Timetable, newDoc);
            tempSlots.push({ ...newDoc, id: res.id });
          }
        }
      }
    }
    this.isGenerating.set(false);
    this.loadData();
  }

  async deleteSlot() {
    if (confirm("Delete this entry?")) {
      await this.fb.deleteDocument(FirebaseCollections.Timetable, this.editingSlot().id);
      this.showEditModal.set(false);
      this.loadData();
    }
  }
}