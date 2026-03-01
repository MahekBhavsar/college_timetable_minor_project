import { Component, signal, OnInit, inject, ChangeDetectorRef, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { FirebaseService } from '../services/firebaseservice';
import { FirebaseCollections } from '../services/firebase-enums';
import { BehaviorSubject, Subscription } from 'rxjs';
import { AdminLayoutComponent } from '../admin-layout/admin-layout';

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
  imports: [FormsModule, CommonModule, AdminLayoutComponent],
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

  startTime = signal<Record<number, string>>({
    1: "11:00", 2: "11:00", 3: "11:00", 4: "11:00", 5: "09:20", 6: "09:20"
  });
  endTime = signal<Record<number, string>>({
    1: "16:30", 2: "16:30", 3: "16:30", 4: "16:30", 5: "14:50", 6: "14:50"
  });

  selectedSem = signal<number>(4);
  selectedDiv = signal<string>('A');
  selectedStaffId = signal<string>('');

  updateStartTime(time: string) {
    this.startTime.update(v => ({ ...v, [this.selectedSem()]: time }));
  }

  updateEndTime(time: string) {
    this.endTime.update(v => ({ ...v, [this.selectedSem()]: time }));
  }

  staffList = signal<any[]>([]);
  allSubjects = signal<any[]>([]);
  allRooms = signal<any[]>([]);
  roomConfigs = signal<any[]>([]);
  editingSlot = signal<any>(null);

  days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  get trackingMetrics() {
    const sem = this.selectedSem();
    const div = this.selectedDiv();
    const subjects = this.allSubjects().filter(sub => sub.semester === sem && (sub.allowedDivisions || []).includes(div));

    let expectedLec = 0;
    let expectedLab = 0;
    const expectedSubjects: any = {};

    subjects.forEach(sub => {
      const lCount = Number(sub.lectureCount) || 0;
      const labCount = Number(sub.labCount) || 0;
      expectedLec += lCount;
      expectedLab += labCount;
      expectedSubjects[sub.name] = { expected: lCount + labCount, scheduled: 0 };
    });

    const slots = this.timetableSource.value.filter(s => s.sem === sem && s.div === div);
    let scheduledLec = 0;
    let scheduledLab = 0;

    slots.forEach(s => {
      if (s.type === 'Lecture') scheduledLec++;
      if (s.type === 'Lab') scheduledLab++;
      if (expectedSubjects[s.subject]) expectedSubjects[s.subject].scheduled++;
    });

    const missing: string[] = [];
    for (const subName in expectedSubjects) {
      const info = expectedSubjects[subName];
      if (info.scheduled < info.expected) {
        missing.push(`${subName} (Missing ${info.expected - info.scheduled})`);
      }
    }

    return { expectedLec, expectedLab, scheduledLec, scheduledLab, missing };
  }

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

  getTimeSlotsForSem(sem: number) {
    const slots = [];
    let current = this.convertInputToMinutes(this.startTime()[sem] || "11:00");
    const end = this.convertInputToMinutes(this.endTime()[sem] || "16:30");
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
    const activeSlots = this.getTimeSlotsForSem(targetSem).filter((s: any) => !s.isRecess);

    // Fetch current state of all timetables for conflict checking
    const allExistingSlots = [...this.timetableSource.value];
    const otherDivSlots = allExistingSlots.filter(s => !(s.sem === targetSem && s.div === targetDiv));

    let pool: any[] = [];
    const subjects = this.allSubjects().filter(sub => sub.semester === targetSem && sub.allowedDivisions?.includes(targetDiv));

    subjects.forEach(sub => {
      const primaryId = sub.divisionStaff?.[targetDiv] || '';
      const primaryName = this.staffList().find(s => s.id === primaryId)?.name || 'Unassigned';

      const lCount = Number(sub.lectureCount) || 0;
      for (let i = 0; i < lCount; i++)
        pool.push({ id: Math.random().toString(), subject: sub.name, type: 'Lecture', staffId: primaryId, staffName: primaryName, room: config.homeRoomName, subType: (sub.type || '').toUpperCase() });

      const labs = config.selectedLabs || [];
      const labCount = Number(sub.labCount) || 0;
      for (let i = 0; i < labCount; i++) {
        const labRoom = this.allRooms().find(r => r.id === labs[i % labs.length])?.name || 'Lab';
        pool.push({ id: Math.random().toString(), subject: sub.name, type: 'Lab', staffId: primaryId, staffName: primaryName, room: labRoom, subType: (sub.type || '').toUpperCase() });
      }
    });

    if (pool.length === 0) { alert("No subjects found for this division!"); this.isGenerating.set(false); return; }
    if (pool.length > activeSlots.length * 6) { alert(`Too many requirements (${pool.length}) for available slots (${activeSlots.length * 6}).`); this.isGenerating.set(false); return; }

    const isStaffBusy = (staffId: string, day: string, timeLabel: string, schedule: any[]) => staffId && schedule.some(s => s.day === day && s.time === timeLabel && s.staffId === staffId);
    const isRoomBusy = (roomName: string, day: string, timeLabel: string, schedule: any[]) => roomName && schedule.some(s => s.day === day && s.time === timeLabel && s.roomName === roomName);

    const findLabSubstitute = (day: string, timeLabel: string, schedule: any[]) => {
      return this.staffList().find(st => {
        const primarySub = this.allSubjects().find(s => s.divisionStaff?.A === st.id || s.divisionStaff?.B === st.id || s.divisionStaff?.C === st.id);
        const dept = (primarySub?.department || '').toUpperCase().trim();
        const restricted = ['MATHEMATICS', 'MATHS', 'AEC', 'VAC', 'SEC', 'COMMUNICATIONS', 'COMM', 'ENGLISH'];
        return !restricted.includes(dept) && !isStaffBusy(st.id, day, timeLabel, schedule);
      });
    };

    const isLabAligning = (day: string, timeLabel: string) => otherDivSlots.some(s => s.sem === targetSem && s.type === 'Lab' && s.day === day && s.time === timeLabel);

    const minorTypes = ['AEC', 'SEC', 'VAC', 'MINOR'];
    let bestSchedule: any[] = [];
    let foundPerfect = false;

    // Retry loop for constraint deadlocks
    for (let restart = 0; restart < 2500; restart++) {
      let currentSchedule = [...otherDivSlots];
      let newDivSchedule: any[] = [];

      let groupedBySubject: Record<string, any[]> = {};
      for (const item of pool) {
        if (!groupedBySubject[item.subject]) groupedBySubject[item.subject] = [];
        groupedBySubject[item.subject].push(item);
      }
      let currentPool = Object.values(groupedBySubject)
        .sort(() => Math.random() - 0.5)
        .flat();

      let divSuccess = true;

      for (const item of currentPool) {
        let validOptions: { day: string, slotLabel: string, score: number, staffId: string, staffName: string }[] = [];
        const isMinor = minorTypes.includes(item.subType);

        for (let dIdx = 0; dIdx < 6; dIdx++) {
          const day = this.days[dIdx];
          const isSaturday = day === 'Saturday';

          if (item.type === 'Lecture' && newDivSchedule.some(s => s.day === day && s.subject === item.subject)) continue;
          if (item.type === 'Lab' && newDivSchedule.filter(s => s.day === day && s.type === 'Lab').length >= 2) continue;

          for (let sIdx = 0; sIdx < activeSlots.length; sIdx++) {
            const timeSlot = activeSlots[sIdx];

            if (newDivSchedule.some(s => s.day === day && s.time === timeSlot.label)) continue;
            if (isRoomBusy(item.room, day, timeSlot.label, currentSchedule)) continue;

            let validStaffId = '';
            let validStaffName = '';

            if (!isStaffBusy(item.staffId, day, timeSlot.label, currentSchedule)) {
              validStaffId = item.staffId;
              validStaffName = item.staffName;
            } else if (item.type === 'Lab') {
              const sub = findLabSubstitute(day, timeSlot.label, currentSchedule);
              if (sub) {
                validStaffId = sub.id;
                validStaffName = sub.name;
              }
            }

            if (!validStaffId) continue;

            let score = Math.random() * 5;

            if (isSaturday) {
              if (isMinor) score += 500;
              else score -= 200;
            } else {
              if (isMinor) score -= 100;
            }

            if (item.type === 'Lab' && isLabAligning(day, timeSlot.label)) score += 1000;

            score += sIdx * 5;

            const dayClasses = newDivSchedule.filter(s => s.day === day);
            if (dayClasses.length > 0) {
              const indices = dayClasses.map(c => activeSlots.findIndex((a: any) => a.label === c.time));
              const minIdx = Math.min(...indices);
              const maxIdx = Math.max(...indices);

              // STRICT GAPLESS: Only allow placing adjacent to existing classes
              if (sIdx !== minIdx - 1 && sIdx !== maxIdx + 1) {
                continue;
              }
            }

            let hasSameSubjectAdjacent = false;

            if (sIdx > 0) {
              const prevLabel = activeSlots[sIdx - 1].label;
              const prevClass = dayClasses.find(s => s.time === prevLabel);
              if (prevClass && prevClass.subject === item.subject) hasSameSubjectAdjacent = true;
            }
            if (sIdx < activeSlots.length - 1) {
              const nextLabel = activeSlots[sIdx + 1].label;
              const nextClass = dayClasses.find(s => s.time === nextLabel);
              if (nextClass && nextClass.subject === item.subject) hasSameSubjectAdjacent = true;
            }

            // "No Free Weekday" Logic - heavily prioritize picking an empty explicitly
            if (!isSaturday && dayClasses.length === 0) {
              score += 2000;
            }

            if (hasSameSubjectAdjacent) score += 200;

            validOptions.push({ day, slotLabel: timeSlot.label, score, staffId: validStaffId, staffName: validStaffName });
          }
        }

        if (validOptions.length === 0) { divSuccess = false; break; }

        validOptions.sort((a, b) => b.score - a.score);
        const best = validOptions[0];

        const newSlot = {
          id: Math.random().toString(), day: best.day, time: best.slotLabel, sem: targetSem, div: targetDiv, staffId: best.staffId, staffName: best.staffName, subject: item.subject, type: item.type, roomName: item.room
        };

        newDivSchedule.push(newSlot);
        currentSchedule.push(newSlot);
      }

      if (divSuccess) { foundPerfect = true; bestSchedule = newDivSchedule; break; }
      else if (newDivSchedule.length > bestSchedule.length) { bestSchedule = newDivSchedule; }
    }

    // --- DESPERATION FALLBACK OVERRIDE ---
    if (!foundPerfect) {
      let finalSchedule = [...bestSchedule];
      const unplacedPool: any[] = [];
      for (const item of pool) {
        const sCount = finalSchedule.filter(s => s.subject === item.subject && s.type === item.type).length;
        const targetCount = pool.filter(p => p.subject === item.subject && p.type === item.type).length;
        if (unplacedPool.filter(u => u.subject === item.subject && u.type === item.type).length < (targetCount - sCount))
          unplacedPool.push(item);
      }

      for (const missingItem of unplacedPool) {
        let placed = false;
        for (let dIdx = 0; dIdx < 6; dIdx++) {
          if (placed) break;
          const day = this.days[dIdx];
          for (const timeSlot of activeSlots) {
            if (!finalSchedule.some(s => s.day === day && s.time === timeSlot.label)) {
              finalSchedule.push({ id: Math.random().toString(), day, time: timeSlot.label, sem: targetSem, div: targetDiv, staffId: missingItem.staffId, staffName: missingItem.staffName, subject: missingItem.subject, type: missingItem.type, roomName: missingItem.room });
              placed = true; break;
            }
          }
        }
      }
      bestSchedule = finalSchedule;
    }

    const old = allExistingSlots.filter(s => s.sem === targetSem && s.div === targetDiv);
    for (const slotDoc of old) if (slotDoc.id) await this.fb.deleteDocument(FirebaseCollections.Timetable, slotDoc.id);

    for (const slotDoc of bestSchedule) {
      const { id, ...cleanSlot } = slotDoc;
      await this.fb.addDocument(FirebaseCollections.Timetable, cleanSlot);
    }

    this.isGenerating.set(false);
    if (foundPerfect) alert("Perfect Timetable Generated! All classes scheduled successfully.");
    else alert(`Warning: Unperfect Timetable. Placed ${bestSchedule.length} out of ${pool.length} classes due to constraint deadlocks.`);
  }

  async generateMassTimetable(type: 'odd' | 'even') {
    const targetSemesters = type === 'odd' ? [1, 3, 5] : [2, 4, 6];
    const divisions = ['A', 'B', 'C'];

    this.isGenerating.set(true);

    // Fetch current state of all timetables for conflict checking (we'll overwrite target sems)
    const allExistingSlots = [...this.timetableSource.value];
    const otherSemsSlots = allExistingSlots.filter(s => !targetSemesters.includes(s.sem));

    // Build the global pool: a map of { sem_div: requirements }
    const globalPools: Record<string, any[]> = {};
    let totalClasses = 0;
    const configuredDivs: { sem: number, div: string }[] = [];

    for (const sem of targetSemesters) {
      for (const div of divisions) {
        const key = `${sem}_${div}`;
        const config = this.roomConfigs().find(c => c.semester === sem && c.division === div);

        // Ensure Subject 'allowedDivisions' includes this div explicitly
        const subjects = this.allSubjects().filter(sub => sub.semester === sem && (sub.allowedDivisions || []).includes(div));
        if (subjects.length === 0) continue; // Skip divisions with no subjects

        globalPools[key] = [];
        configuredDivs.push({ sem, div });

        subjects.forEach(sub => {
          const primaryId = sub.divisionStaff?.[div] || '';
          const primaryName = this.staffList().find(s => s.id === primaryId)?.name || 'Unassigned';

          const lCount = Number(sub.lectureCount) || 0;
          for (let i = 0; i < lCount; i++) {
            globalPools[key].push({ id: Math.random().toString(), subject: sub.name, type: 'Lecture', staffId: primaryId, staffName: primaryName, room: config?.homeRoomName || `Class ${sem}-${div}`, subType: (sub.type || '').toUpperCase() });
            totalClasses++;
          }

          const labs = config?.selectedLabs || [];
          const labCount = Number(sub.labCount) || 0;
          for (let i = 0; i < labCount; i++) {
            const labRoom = labs.length > 0 ? (this.allRooms().find(r => r.id === labs[i % labs.length])?.name || 'Lab') : 'Lab';
            globalPools[key].push({ id: Math.random().toString(), subject: sub.name, type: 'Lab', staffId: primaryId, staffName: primaryName, room: labRoom, subType: (sub.type || '').toUpperCase() });
            totalClasses++;
          }
        });
      }
    }

    if (totalClasses === 0) { alert(`No subjects found explicitly allowing Div A, B, or C across ${type} semesters!`); this.isGenerating.set(false); return; }

    const isStaffBusy = (staffId: string, day: string, timeLabel: string, schedule: any[]) => staffId && schedule.some(s => s.day === day && s.time === timeLabel && s.staffId === staffId);
    const isRoomBusy = (roomName: string, day: string, timeLabel: string, schedule: any[]) => roomName && schedule.some(s => s.day === day && s.time === timeLabel && s.roomName === roomName);

    const findLabSubstitute = (day: string, timeLabel: string, schedule: any[]) => {
      return this.staffList().find(st => {
        const primarySub = this.allSubjects().find(s => s.divisionStaff?.A === st.id || s.divisionStaff?.B === st.id || s.divisionStaff?.C === st.id);
        const dept = (primarySub?.department || '').toUpperCase().trim();
        const restricted = ['MATHEMATICS', 'MATHS', 'AEC', 'VAC', 'SEC', 'COMMUNICATIONS', 'COMM', 'ENGLISH'];
        return !restricted.includes(dept) && !isStaffBusy(st.id, day, timeLabel, schedule);
      });
    };

    const isLabAligning = (sem: number, day: string, timeLabel: string, schedule: any[]) => schedule.some(s => s.sem === sem && s.type === 'Lab' && s.day === day && s.time === timeLabel);

    const minorTypes = ['AEC', 'SEC', 'VAC', 'MINOR'];
    let bestGlobalSchedule: any[] = [];
    let foundPerfect = false;

    // Retry loop for constraint deadlocks - Massive scale
    for (let restart = 0; restart < 1000; restart++) {
      let currentGlobalSchedule = [...otherSemsSlots];
      let newGlobalSchedule: any[] = [];
      let globalSuccess = true;

      // Randomize division order to avoid systematic bottlenecks
      const shuffledDivs = [...configuredDivs].sort(() => Math.random() - 0.5);

      for (const target of shuffledDivs) {
        const sem = target.sem;
        const div = target.div;
        const key = `${sem}_${div}`;

        const activeSlots = this.getTimeSlotsForSem(sem).filter((s: any) => !s.isRecess);

        let currentPool = [...globalPools[key]].sort(() => Math.random() - 0.5);
        let divSchedule: any[] = [];
        let divSuccess = true;

        for (const item of currentPool) {
          let validOptions: { day: string, slotLabel: string, score: number, staffId: string, staffName: string }[] = [];
          const isMinor = minorTypes.includes(item.subType);

          for (let dIdx = 0; dIdx < 6; dIdx++) {
            const day = this.days[dIdx];
            const isSaturday = day === 'Saturday';

            if (item.type === 'Lecture' && divSchedule.some(s => s.day === day && s.subject === item.subject)) continue;
            if (item.type === 'Lab' && divSchedule.filter(s => s.day === day && s.type === 'Lab').length >= 2) continue;

            for (let sIdx = 0; sIdx < activeSlots.length; sIdx++) {
              const timeSlot = activeSlots[sIdx];

              if (divSchedule.some(s => s.day === day && s.time === timeSlot.label)) continue;
              if (isRoomBusy(item.room, day, timeSlot.label, currentGlobalSchedule)) continue;

              let validStaffId = '';
              let validStaffName = '';

              if (!isStaffBusy(item.staffId, day, timeSlot.label, currentGlobalSchedule)) {
                validStaffId = item.staffId;
                validStaffName = item.staffName;
              } else if (item.type === 'Lab') {
                const sub = findLabSubstitute(day, timeSlot.label, currentGlobalSchedule);
                if (sub) {
                  validStaffId = sub.id;
                  validStaffName = sub.name;
                }
              }

              if (!validStaffId) continue;

              let score = Math.random() * 5;

              if (isSaturday) {
                if (isMinor) score += 500;
                else score -= 200;
              } else {
                if (isMinor) score -= 100;
              }

              if (item.type === 'Lab' && isLabAligning(sem, day, timeSlot.label, currentGlobalSchedule)) score += 1000;

              score += sIdx * 5;

              const dayClasses = divSchedule.filter(s => s.day === day);
              if (dayClasses.length > 0) {
                const indices = dayClasses.map(c => activeSlots.findIndex((a: any) => a.label === c.time));
                const minIdx = Math.min(...indices);
                const maxIdx = Math.max(...indices);

                // STRICT GAPLESS: Only allow placing adjacent to existing classes
                if (sIdx !== minIdx - 1 && sIdx !== maxIdx + 1) {
                  continue;
                }
              }

              let hasSameSubjectAdjacent = false;

              if (sIdx > 0) {
                const prevLabel = activeSlots[sIdx - 1].label;
                const prevClass = dayClasses.find(s => s.time === prevLabel);
                if (prevClass && prevClass.subject === item.subject) hasSameSubjectAdjacent = true;
              }
              if (sIdx < activeSlots.length - 1) {
                const nextLabel = activeSlots[sIdx + 1].label;
                const nextClass = dayClasses.find(s => s.time === nextLabel);
                if (nextClass && nextClass.subject === item.subject) hasSameSubjectAdjacent = true;
              }

              // "No Free Weekday" Logic - heavily prioritize picking an empty explicitly
              if (!isSaturday && dayClasses.length === 0) {
                score += 2000;
              }

              if (hasSameSubjectAdjacent) score += 200;

              validOptions.push({ day, slotLabel: timeSlot.label, score, staffId: validStaffId, staffName: validStaffName });
            }
          }

          if (validOptions.length === 0) { divSuccess = false; break; }

          validOptions.sort((a, b) => b.score - a.score);
          const best = validOptions[0];

          const newSlot = {
            id: Math.random().toString(), day: best.day, time: best.slotLabel, sem, div, staffId: best.staffId, staffName: best.staffName, subject: item.subject, type: item.type, roomName: item.room
          };

          divSchedule.push(newSlot);
          currentGlobalSchedule.push(newSlot);
          newGlobalSchedule.push(newSlot);
        }

        if (!divSuccess) { globalSuccess = false; break; }
      }

      if (globalSuccess) { foundPerfect = true; bestGlobalSchedule = newGlobalSchedule; break; }
      else if (newGlobalSchedule.length > bestGlobalSchedule.length) { bestGlobalSchedule = newGlobalSchedule; }
    }

    // --- DESPERATION FALLBACK OVERRIDE (GLOBAL) ---
    if (!foundPerfect && bestGlobalSchedule.length > 0) {
      for (const target of configuredDivs) {
        const sem = target.sem;
        const div = target.div;
        const key = `${sem}_${div}`;
        const pool = globalPools[key];
        const activeSlots = this.getTimeSlotsForSem(sem).filter((s: any) => !s.isRecess);

        const unplacedPool: any[] = [];
        for (const item of pool) {
          const classSCount = bestGlobalSchedule.filter(s => s.sem === sem && s.div === div && s.subject === item.subject && s.type === item.type).length;
          const classTargetCount = pool.filter(p => p.subject === item.subject && p.type === item.type).length;
          if (unplacedPool.filter(u => u.subject === item.subject && u.type === item.type).length < (classTargetCount - classSCount)) {
            unplacedPool.push(item);
          }
        }

        for (const missingItem of unplacedPool) {
          let placed = false;
          for (let dIdx = 0; dIdx < 6; dIdx++) {
            if (placed) break;
            const day = this.days[dIdx];
            for (const timeSlot of activeSlots) {
              if (!bestGlobalSchedule.some(s => s.sem === sem && s.div === div && s.day === day && s.time === timeSlot.label)) {
                bestGlobalSchedule.push({ id: Math.random().toString(), day, time: timeSlot.label, sem, div, staffId: missingItem.staffId, staffName: missingItem.staffName, subject: missingItem.subject, type: missingItem.type, roomName: missingItem.room });
                placed = true; break;
              }
            }
          }
        }
      }
    }

    const old = allExistingSlots.filter(s => targetSemesters.includes(s.sem));
    for (const slotDoc of old) if (slotDoc.id) await this.fb.deleteDocument(FirebaseCollections.Timetable, slotDoc.id);

    for (const slotDoc of bestGlobalSchedule) {
      const { id, ...cleanSlot } = slotDoc;
      await this.fb.addDocument(FirebaseCollections.Timetable, cleanSlot);
    }

    this.isGenerating.set(false);
    if (foundPerfect) alert(`Perfect Bulk Timetable Generated! All classes for ${type} semesters scheduled successfully.`);
    else alert(`Warning: Unperfect Bulk Timetable. Placed ${bestGlobalSchedule.length} out of ${totalClasses} classes due to severe global constraints.`);
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
    if (!t) return 0;
    let [h, m] = t.split(':').map(Number);
    if (h > 0 && h <= 6) h += 12; // Auto-correct 12-hour AM/PM anomalies if user types 04:30 instead of 16:30 for 4:30 PM
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