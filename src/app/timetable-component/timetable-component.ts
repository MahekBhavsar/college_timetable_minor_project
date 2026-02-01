import { Component, signal, OnInit, inject, ChangeDetectorRef, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { FirebaseService } from '../services/firebaseservice';
import { FirebaseCollections } from '../services/firebase-enums';
import { BehaviorSubject, Subscription } from 'rxjs';

interface TimetableSlot { 
  id?: string; 
  day: string; 
  time: string; 
  sem: number; 
  div: string; 
  staffId: string; 
  staffName: string; 
  subject: string; 
  type: string; 
  roomName?: string; 
}

@Component({
  selector: 'app-timetable',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './timetable-component.html',
  styles: [`
    .modal-backdrop { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.5); z-index: 1040; }
    .modal.show { display: block; z-index: 1050; }
    .slot-cell { min-height: 110px; cursor: pointer; vertical-align: top; border: 1px solid #dee2e6 !important; transition: background 0.2s; }
    .slot-cell:hover { background: #f8f9fa !important; }
    .recess-row { background-color: #fff4e6 !important; border: 2px solid #ffd8a8 !important; }
    .lecture-card { border-radius: 6px; border-left: 5px solid; transition: transform 0.1s; cursor: pointer; }
    .type-lab { border-left-color: #ffc107 !important; background: #fffdf5; }
    .type-lecture { border-left-color: #0d6efd !important; background: #f0f7ff; }
    .empty-placeholder { color: #adb5bd; font-size: 0.75rem; text-align: center; padding-top: 25px; font-weight: 500; }
    .room-badge { font-size: 0.65rem; background: #e9ecef; color: #495057; padding: 2px 5px; border-radius: 4px; display: inline-block; margin-top: 4px; }
  `]
})
export class TimetableComponent implements OnInit, OnDestroy {
  public fb = inject(FirebaseService);
  private cdr = inject(ChangeDetectorRef);

  public timetableSource = new BehaviorSubject<TimetableSlot[]>([]);
  timetable$ = this.timetableSource.asObservable();
  private sub = new Subscription();

  isLoading = signal(true);
  isGenerating = signal(false);
  showEditModal = signal(false);
  viewMode = signal<'class' | 'staff'>('class');

  startTime = signal<string>("08:00");
  endTime = signal<string>("16:00");

  selectedSem = signal<number>(1);
  selectedDiv = signal<string>('A');
  selectedStaffId = signal<string>('');

  staffList = signal<any[]>([]);
  allSubjects = signal<any[]>([]);
  allRooms = signal<any[]>([]); // Added
  roomConfigs = signal<any[]>([]); // Added
  editingSlot = signal<any>(null);

  days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  ngOnInit() { this.loadData(); }

  loadData() {
    this.isLoading.set(true);
    this.sub.add(this.fb.getCollection(FirebaseCollections.Timetable).subscribe(data => {
      this.timetableSource.next(data as TimetableSlot[]);
      this.isLoading.set(false);
      this.cdr.detectChanges(); 
    }));
    this.sub.add(this.fb.getCollection(FirebaseCollections.Staff).subscribe(d => this.staffList.set(d)));
    this.sub.add(this.fb.getCollection(FirebaseCollections.Subjects).subscribe(d => this.allSubjects.set(d)));
    this.sub.add(this.fb.getCollection('rooms' as any).subscribe(d => this.allRooms.set(d)));
    this.sub.add(this.fb.getCollection('division_allocations' as any).subscribe(d => this.roomConfigs.set(d)));
  }

  get currentTimeSlots() {
    const slots = [];
    let current = this.convertInputToMinutes(this.startTime());
    const end = this.convertInputToMinutes(this.endTime());
    const RECESS_START = 810; // 01:30 PM
    const RECESS_END = 840;   // 02:00 PM

    while (current < end) {
      if (current + 50 <= RECESS_START) {
        slots.push({ label: `${this.convertToTime(current)} - ${this.convertToTime(current + 50)}`, isRecess: false });
        current += 50;
      } else if (current < RECESS_END) {
        slots.push({ label: '01:30 PM - 02:00 PM', isRecess: true });
        current = RECESS_END;
      } else if (current + 50 <= end) {
        slots.push({ label: `${this.convertToTime(current)} - ${this.convertToTime(current + 50)}`, isRecess: false });
        current += 50;
      } else break;
    }
    return slots;
  }

  async generateFullTimetable() {
    // 1. Get Room Configuration for current Div
    const config = this.roomConfigs().find(c => c.division === this.selectedDiv() && c.semester === this.selectedSem());
    if (!config) {
      alert(`Please setup Classroom & Labs for Div ${this.selectedDiv()} first!`);
      return;
    }

    if (!confirm(`Generate Timetable with Room Assignments for Div ${this.selectedDiv()}?`)) return;
    
    this.isGenerating.set(true);
    const targetSem = this.selectedSem();
    const targetDiv = this.selectedDiv();
    const activeSlots = this.currentTimeSlots.filter(s => !s.isRecess);

    let pool: any[] = [];
    const subjects = this.allSubjects().filter(sub => sub.semester === targetSem);
    
    subjects.forEach(sub => {
      const staffId = sub.divisionStaff?.[targetDiv] || '';
      const staffName = this.staffList().find(st => st.id === staffId)?.name || 'Unassigned';
      
      // Assign Rooms during pool creation
      for (let i = 0; i < (sub.lectureCount || 0); i++) 
        pool.push({ 
          subject: sub.name, type: 'Lecture', staffId, staffName, 
          roomName: config.homeRoomName || 'Classroom' 
        });

      for (let i = 0; i < (sub.labCount || 0); i++) {
        // Cycle through assigned labs
        const labId = config.selectedLabs?.[i % config.selectedLabs.length];
        const labRoom = this.allRooms().find(r => r.id === labId);
        pool.push({ 
          subject: sub.name, type: 'Lab', staffId, staffName, 
          roomName: labRoom?.name || 'Lab' 
        });
      }
    });

    pool = pool.sort(() => Math.random() - 0.5);

    for (const day of this.days) {
      let dailyLabCount = 0;
      let dayHasStarted = false; 

      for (const slot of activeSlots) {
        if (pool.length === 0) break;

        const isOccupied = this.timetableSource.value.some(s => 
          s.day === day && s.time === slot.label && s.sem === targetSem && s.div === targetDiv
        );
        if (isOccupied) { dayHasStarted = true; continue; }

        const matchIdx = pool.findIndex(item => {
          const isRepeat = this.timetableSource.value.some(s => 
            s.day === day && s.sem === targetSem && s.div === targetDiv && s.subject === item.subject
          );
          if (isRepeat) return false;

          const isTeacherBusy = this.timetableSource.value.some(s => 
            s.day === day && s.time === slot.label && s.staffId === item.staffId && item.staffId !== ''
          );
          if (isTeacherBusy) return false;

          if (item.type === 'Lab' && dailyLabCount >= 2) return false;
          return true;
        });

        if (matchIdx !== -1) {
          const selected = pool.splice(matchIdx, 1)[0];
          if (selected.type === 'Lab') dailyLabCount++;

          const entry: TimetableSlot = {
            day, time: slot.label, sem: targetSem, div: targetDiv,
            staffId: selected.staffId, staffName: selected.staffName,
            subject: selected.subject, type: selected.type,
            roomName: selected.roomName // Saved Room
          };

          dayHasStarted = true;
          await this.fb.addDocument(FirebaseCollections.Timetable, entry);
        } else {
          if (dayHasStarted) break; 
        }
      }
    }
    this.isGenerating.set(false);
  }

  async saveSlot() {
    const s = this.editingSlot();
    const staff = this.staffList().find(st => st.id === s.staffId);
    s.staffName = staff?.name || '';

    // If manually editing, try to find a room if not set
    if (!s.roomName) {
        const config = this.roomConfigs().find(c => c.division === s.div && c.semester === s.sem);
        s.roomName = s.type === 'Lecture' ? config?.homeRoomName : 'Lab';
    }

    if (s.id) await this.fb.updateDocument(FirebaseCollections.Timetable, s.id, s);
    else await this.fb.addDocument(FirebaseCollections.Timetable, s);
    this.showEditModal.set(false);
  }

  async clearFullTimetable() {
    if (!confirm(`Clear current selection?`)) return;
    this.isGenerating.set(true);
    const toDelete = this.timetableSource.value.filter(s => s.sem === this.selectedSem() && s.div === this.selectedDiv());
    for (const slot of toDelete) { if (slot.id) await this.fb.deleteDocument(FirebaseCollections.Timetable, slot.id); }
    this.isGenerating.set(false);
  }

  openEdit(day: string, time: string) {
    const existing = this.timetableSource.value.find(s => 
      s.day === day && s.time === time && s.sem === this.selectedSem() && s.div === this.selectedDiv()
    );
    this.editingSlot.set(existing ? { ...existing } : { 
      day, time, sem: this.selectedSem(), div: this.selectedDiv(), 
      staffId: '', staffName: '', subject: '', type: 'Lecture' 
    });
    this.showEditModal.set(true);
  }

  async deleteSlot() {
    if (this.editingSlot()?.id && confirm('Delete?')) {
      await this.fb.deleteDocument(FirebaseCollections.Timetable, this.editingSlot().id);
      this.showEditModal.set(false);
    }
  }

  private convertInputToMinutes(t: string): number {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  }

  private convertToTime(min: number): string {
    let h = Math.floor(min / 60);
    const m = min % 60;
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')} ${ampm}`;
  }

  ngOnDestroy() { this.sub.unsubscribe(); }
}