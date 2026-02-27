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

    startTime = signal<string>("11:00");
    endTime = signal<string>("16:30");

    selectedSem = signal<number>(4);
    selectedDiv = signal<string>('A');
    selectedStaffId = signal<string>(''); 

    staffList = signal<any[]>([]);
    allSubjects = signal<any[]>([]);
    allRooms = signal<any[]>([]); 
    roomConfigs = signal<any[]>([]); 
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
      const RECESS_START = 810; 
      const RECESS_END = 840;   

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
  const config = this.roomConfigs().find(c => c.division === this.selectedDiv() && c.semester === this.selectedSem());
  if (!config) { alert(`Setup Div ${this.selectedDiv()} config first!`); return; }

  this.isGenerating.set(true);
  const targetSem = this.selectedSem();
  const targetDiv = this.selectedDiv();
  const activeSlots = this.currentTimeSlots.filter(s => !s.isRecess);
  
  // 1. DRAIN THE POOL: Build all requirements for this division
  let pool: any[] = [];
  const subjects = this.allSubjects().filter(sub => sub.semester === targetSem && sub.allowedDivisions?.includes(targetDiv));

  subjects.forEach(sub => {
    const primaryId = sub.divisionStaff?.[targetDiv] || '';
    const primaryName = this.staffList().find(s => s.id === primaryId)?.name || 'Unassigned';
    
    for (let i = 0; i < (Number(sub.lectureCount) || 0); i++) 
      pool.push({ subject: sub.name, type: 'Lecture', staffId: primaryId, staffName: primaryName, room: config.homeRoomName, subType: sub.type });

    const labs = config.selectedLabs || [];
    for (let i = 0; i < (Number(sub.labCount) || 0); i++) {
      const labRoom = this.allRooms().find(r => r.id === labs[i % labs.length])?.name || 'Lab';
      pool.push({ subject: sub.name, type: 'Lab', staffId: primaryId, staffName: primaryName, room: labRoom, subType: sub.type });
    }
  });

  // Shuffle pool to ensure random distribution across days
  pool = pool.sort(() => Math.random() - 0.5);

  // Clear existing division data
  const old = this.timetableSource.value.filter(s => s.sem === targetSem && s.div === targetDiv);
  for (const slotDoc of old) { if (slotDoc.id) await this.fb.deleteDocument(FirebaseCollections.Timetable, slotDoc.id); }

  // 2. SEQUENTIAL PACKING: No In-Between Gaps
  for (const day of this.days) {
    let dayHasStarted = false;
    let lecturesToday = 0;
    const isSaturday = day === 'Saturday';

    for (let i = 0; i < activeSlots.length; i++) {
      const currentSlot = activeSlots[i];
      if (pool.length === 0) break;

      let matchIdx = -1;
      let finalStaffId = '';
      let finalStaffName = '';

      // Try every item in the pool for THIS specific time slot
      for (let pIdx = 0; pIdx < pool.length; pIdx++) {
        const item = pool[pIdx];

        // Saturday prioritization
        if (isSaturday && item.subType === 'Major' && pool.some(p => p.subType !== 'Major')) continue;

        // Constraint: One subject per day max
        const isSubjectRepeat = this.timetableSource.value.some(s => 
          s.day === day && s.sem === targetSem && s.div === targetDiv && s.subject === item.subject
        );
        if (isSubjectRepeat) continue;

        // 🔥 GLOBAL CLASH CHECK: Must be free across ALL divisions
        const isStaffBusy = this.timetableSource.value.some(s => 
          s.day === day && s.time === currentSlot.label && s.staffId === item.staffId && item.staffId !== ''
        );

        if (!isStaffBusy) {
          finalStaffId = item.staffId;
          finalStaffName = item.staffName;
          matchIdx = pIdx;
          break; 
        } else if (item.type === 'Lab') {
          // 🔥 SUBSTITUTE SEARCH: Only BCA Technical staff
          const substitute = this.staffList().find(st => {
            const primarySub = this.allSubjects().find(sub => 
              sub.divisionStaff?.A === st.id || sub.divisionStaff?.B === st.id || sub.divisionStaff?.C === st.id
            );
            const dept = (primarySub?.department || '').toUpperCase().trim();
            const restricted = ['MATHEMATICS', 'AEC', 'VAC', 'SEC', 'COMMUNICATIONS', 'COMM'].includes(dept);

            const isSubBusy = this.timetableSource.value.some(s => 
              s.day === day && s.time === currentSlot.label && s.staffId === st.id
            );
            return !restricted && !isSubBusy;
          });

          if (substitute) {
            finalStaffId = substitute.id;
            finalStaffName = substitute.name;
            matchIdx = pIdx;
            break;
          }
        }
      }

      if (matchIdx !== -1) {
        const selected = pool.splice(matchIdx, 1)[0];
        dayHasStarted = true;
        lecturesToday++;

        await this.fb.addDocument(FirebaseCollections.Timetable, {
          day, time: currentSlot.label, sem: targetSem, div: targetDiv,
          staffId: finalStaffId, staffName: finalStaffName,
          subject: selected.subject, type: selected.type,
          roomName: selected.room 
        });
      } else {
        // 🔥 GAP PREVENTION: If day has started, move to next day ONLY if we hit a total deadlock
        // This allows div to start late or end early, but never have a gap in the middle.
        if (dayHasStarted) break; 
      }
    }
  }
  this.isGenerating.set(false);
  alert("Perfect Timetable Generated! No In-Between Gaps.");
}
    async saveSlot() {
      const s = this.editingSlot();
      const staff = this.staffList().find(st => st.id === s.staffId);
      s.staffName = staff?.name || '';
      if (s.id) await this.fb.updateDocument(FirebaseCollections.Timetable, s.id, s);
      else await this.fb.addDocument(FirebaseCollections.Timetable, s);
      this.showEditModal.set(false);
    }

    async deleteSlot() {
      if (this.editingSlot()?.id && confirm('Delete?')) {
        await this.fb.deleteDocument(FirebaseCollections.Timetable, this.editingSlot().id);
        this.showEditModal.set(false);
      }
    }

    async clearFullTimetable() {
      if (!confirm(`Clear current?`)) return;
      this.isGenerating.set(true);
      const toDelete = this.timetableSource.value.filter(s => s.sem === this.selectedSem() && s.div === this.selectedDiv());
      for (const slotDoc of toDelete) { if (slotDoc.id) await this.fb.deleteDocument(FirebaseCollections.Timetable, slotDoc.id); }
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