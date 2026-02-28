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
    .slot-cell { min-height: 120px; cursor: pointer; border: 1px solid #dee2e6 !important; transition: 0.2s; }
    .slot-cell:hover { background: #f8f9fa; }
    .recess-row { background-color: #fff4e6 !important; border: 2px solid #ffd8a8 !important; font-weight: bold; }
    .type-lab { border-left: 5px solid #ffc107 !important; background: #fffdf5; }
    .type-lecture { border-left: 5px solid #0d6efd !important; background: #f0f7ff; }
    .extra-small { font-size: 0.7rem; }
    .w-fit { width: fit-content; }
  `]
})
export class TimetableComponent implements OnInit, OnDestroy {
  public fb = inject(FirebaseService);
  private cdr = inject(ChangeDetectorRef);
  private sub = new Subscription();

  // Configuration Constants
  private readonly SLOT_MINUTES = 50;
  private readonly BREAK_START = 810; // 01:30 PM
  private readonly BREAK_END = 840;   // 02:00 PM
  days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  // Signals for state
  isLoading = signal(true);
  isGenerating = signal(false);
  viewMode = signal<'class' | 'staff'>('class');
  selectedSem = signal<number>(1);
  selectedDiv = signal<string>('A');
  selectedStaffId = signal<string>(''); // FIXED: This was missing
  startTime = signal<string>("11:00");
  endTime = signal<string>("16:30");

  // Data Collections
  public timetableSource = new BehaviorSubject<TimetableSlot[]>([]);
  timetable$ = this.timetableSource.asObservable();
  staffList = signal<any[]>([]);
  allSubjects = signal<any[]>([]);
  roomConfigs = signal<any[]>([]);

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
    this.sub.add(this.fb.getCollection('division_allocations' as any).subscribe(d => this.roomConfigs.set(d)));
  }

  private getConflictPair(sem: number): number {
    return sem % 2 === 0 ? sem - 1 : sem + 1;
  }

  get currentTimeSlots() {
    const slots: { label: string; isRecess: boolean }[] = [];
    let current = this.timeToMinutes(this.startTime());
    const end = this.timeToMinutes(this.endTime());

    while (current + this.SLOT_MINUTES <= end) {
      if (current === this.BREAK_START) {
        slots.push({ label: "01:30 PM - 02:00 PM", isRecess: true });
        current = this.BREAK_END;
        continue;
      }
      slots.push({
        label: `${this.minutesToTime(current)} - ${this.minutesToTime(current + this.SLOT_MINUTES)}`,
        isRecess: false
      });
      current += this.SLOT_MINUTES;
    }
    return slots;
  }

  async generateFullTimetable() {
    const sem = this.selectedSem();
    const pair = this.getConflictPair(sem);
    const configs = this.roomConfigs().filter(c => c.semester === sem);
    const divs = [...new Set(configs.map(c => c.division).filter(Boolean))];

    if (!divs.length) return alert(`Setup configs for Sem ${sem} first`);
    this.isGenerating.set(true);

    const globalBusyStaff = new Map<string, string>();
    const dayLabCount = new Map<string, number>(); 

    try {
      // 1. CYCLE REPLACEMENT: Replace Odd with Even or vice versa
      const old = this.timetableSource.value.filter(s => 
        (s.sem === sem || s.sem === pair) && divs.includes(s.div)
      );
      for (const s of old) { if (s.id) await this.fb.deleteDocument(FirebaseCollections.Timetable, s.id); }

      const scheduleOtherSems = this.timetableSource.value.filter(s => s.sem !== sem && s.sem !== pair);
      const activeSlots = this.currentTimeSlots.filter(s => !s.isRecess);

      const pools = new Map<string, any[]>();
      divs.forEach(div => {
        const homeRoom = configs.find(c => c.division === div)?.homeRoomName || 'B-31';
        pools.set(div, this.getSubjectPool(sem, div, homeRoom));
      });

      for (const day of this.days) {
        for (const slot of activeSlots) {
          for (const div of divs) {
            const pool = pools.get(div) || [];
            const labKey = `${day}-${div}`;
            const currentLabs = dayLabCount.get(labKey) || 0;
            
            const matchIdx = pool.findIndex(item => {
              const staffKey = `${day}-${slot.label}-${item.staffId}`;
              const isStaffBusyNow = globalBusyStaff.has(staffKey);
              const isStaffBusyOther = scheduleOtherSems.some(s => s.day === day && s.time === slot.label && s.staffId === item.staffId);
              const isRoomBusy = scheduleOtherSems.some(s => s.day === day && s.time === slot.label && s.roomName === item.roomName && item.roomName !== 'Lab');

              return !isStaffBusyNow && !isStaffBusyOther && !isRoomBusy && (item.type !== 'Lab' || currentLabs < 3);
            });

            if (matchIdx !== -1) {
              const match = pool[matchIdx];
              await this.saveSlot(day, slot.label, sem, div, match);
              globalBusyStaff.set(`${day}-${slot.label}-${match.staffId}`, div);
              if (match.type === 'Lab') dayLabCount.set(labKey, currentLabs + 1);
              pool.splice(matchIdx, 1);
            }
          }
        }
      }
      alert(`Timetable Generated Perfect! Rules for Sem ${sem} followed.`);
    } finally { this.isGenerating.set(false); }
  }

  private getSubjectPool(sem: number, div: string, room: string) {
    const pool: any[] = [];
    const subjects = this.allSubjects().filter(s => s.semester === sem && s.allowedDivisions?.includes(div));
    
    for (const sub of subjects) {
      const staffId = sub.divisionStaff?.[div] || '';
      const staffName = this.staffList().find(s => s.id === staffId)?.name || 'Unassigned';
      
      for (let i = 0; i < (Number(sub.lectureCount) || 0); i++) {
        pool.push({ subject: sub.name, type: 'Lecture', staffId, staffName, roomName: room });
      }
      for (let i = 0; i < (Number(sub.labCount) || 0); i++) {
        pool.push({ subject: sub.name, type: 'Lab', staffId, staffName, roomName: 'Lab' });
      }
    }
    return this.shuffle(pool);
  }

  private shuffle(array: any[]) {
    return array.sort(() => Math.random() - 0.5);
  }

  private async saveSlot(day: string, time: string, sem: number, div: string, item: any) {
    await this.fb.addDocument(FirebaseCollections.Timetable, {
      day, time, sem, div, staffId: item.staffId, staffName: item.staffName,
      subject: item.subject, type: item.type, roomName: item.roomName
    });
  }

  private timeToMinutes(t: string): number {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  }

  private minutesToTime(min: number): string {
    let h = Math.floor(min / 60);
    const m = min % 60;
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')} ${ampm}`;
  }

  ngOnDestroy() { this.sub.unsubscribe(); }
}