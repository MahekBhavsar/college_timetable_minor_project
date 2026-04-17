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
  styleUrls: ['./timetable-component.css']
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
  staffPreferences = signal<any[]>([]);
  allSubjects = signal<any[]>([]);
  allRooms = signal<any[]>([]);
  roomConfigs = signal<any[]>([]);
  categories = signal<any[]>([]);
  editingSlot = signal<any>(null);

  days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  isMinorSubject(subjectName: string): boolean {
    const sub = this.allSubjects().find(s => s.name === subjectName);
    if (!sub) return false;
    const type = (sub.type || '').toUpperCase();
    const dynamicMinors = this.categories().filter(c => c.isMinor).map(c => c.name.toUpperCase());
    const fallbackMinors = ['AEC', 'SEC', 'VAC', 'MINOR'];
    const minorTypes = dynamicMinors.length > 0 ? dynamicMinors : fallbackMinors;
    return minorTypes.includes(type);
  }

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
    this.sub.add(this.fb.getCollection(FirebaseCollections.StaffPreferences).subscribe(d => this.staffPreferences.set(d)));
    this.sub.add(this.fb.getCollection(FirebaseCollections.Subjects).subscribe(d => this.allSubjects.set(d)));
    this.sub.add(this.fb.getCollection('rooms' as any).subscribe(d => this.allRooms.set(d)));
    this.sub.add(this.fb.getCollection('division_allocations' as any).subscribe(d => this.roomConfigs.set(d)));
    this.sub.add(this.fb.getCollection(FirebaseCollections.Categories).subscribe(d => this.categories.set(d)));
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

  isStaffAvailable(staffId: string, sem: number, slotLabel: string): boolean {
    if (!staffId) return true;
    const prefDoc = this.staffPreferences().find(p => p.staffId === staffId);
    if (!prefDoc) return true; 

    let activePref = null;
    if (prefDoc.preferences && prefDoc.preferences[sem]) {
      activePref = prefDoc.preferences[sem];
    } else if (prefDoc.global) {
      activePref = prefDoc.global;
    }

    if (!activePref) return true; 

    const slotStartStr = slotLabel.split(' - ')[0]; 
    const slotMin = this.convertTimeLabelToMinutes(slotStartStr);
    const prefStartMin = this.convertInputToMinutes(activePref.startTime);
    const prefEndMin = this.convertInputToMinutes(activePref.endTime);

    return slotMin >= prefStartMin && slotMin < prefEndMin;
  }

  private convertTimeLabelToMinutes(label: string): number {
    let [time, modifier] = label.split(' ');
    let [hours, minutes] = time.split(':').map(Number);
    if (hours === 12) hours = 0;
    if (modifier === 'PM') hours += 12;
    return hours * 60 + minutes;
  }

  async generateFullTimetable() {
    const config = this.roomConfigs().find(c => c.division === this.selectedDiv() && c.semester === this.selectedSem());
    if (!config) { alert(`Setup Div ${this.selectedDiv()} config first!`); return; }

    this.isGenerating.set(true);
    const targetSem = this.selectedSem();
    const targetDiv = this.selectedDiv();
    const activeSlots = this.getTimeSlotsForSem(targetSem).filter((s: any) => !s.isRecess);

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
    
    const isStaffBusy = (staffId: string, day: string, timeLabel: string, schedule: any[], sem: number, type: string) => {
      if (!staffId) return false;
      const busy = schedule.some(s => s.day === day && s.time === timeLabel && s.staffId === staffId);
      if (busy) return true;
      if (type === 'Lecture') {
        return !this.isStaffAvailable(staffId, sem, timeLabel);
      }
      return false;
    };
    const isRoomBusy = (roomName: string, day: string, timeLabel: string, schedule: any[]) => roomName && schedule.some(s => s.day === day && s.time === timeLabel && s.roomName === roomName);

    const findLabSubstitute = (day: string, timeLabel: string, schedule: any[], sem: number) => {
      return this.staffList().find(st => {
        if (st.name?.toLowerCase().includes('snehal joshi')) return false;
        const primarySub = this.allSubjects().find(s => s.divisionStaff?.A === st.id || s.divisionStaff?.B === st.id || s.divisionStaff?.C === st.id);
        const dept = (primarySub?.department || '').toUpperCase().trim();
        const restricted = ['MATHEMATICS', 'MATHS', 'AEC', 'VAC', 'SEC', 'COMMUNICATIONS', 'COMM', 'ENGLISH'];
        return !restricted.includes(dept) && !isStaffBusy(st.id, day, timeLabel, schedule, sem, 'Lab');
      });
    };

    const isLabAligning = (day: string, timeLabel: string) => otherDivSlots.some(s => s.sem === targetSem && s.type === 'Lab' && s.day === day && s.time === timeLabel);
    const minorTypes = ['AEC', 'SEC', 'VAC', 'MINOR'];
    let bestSchedule: any[] = [];
    let foundPerfect = false;

    for (let restart = 0; restart < 2500; restart++) {
      let currentSchedule = [...otherDivSlots];
      let newDivSchedule: any[] = [];
      let divSuccess = true;

      let groupedBySubject: Record<string, any[]> = {};
      for (const item of pool) {
        if (!groupedBySubject[item.subject]) groupedBySubject[item.subject] = [];
        groupedBySubject[item.subject].push(item);
      }
      let currentPool = Object.values(groupedBySubject).sort(() => Math.random() - 0.5).flat();

      for (const item of currentPool) {
        if (item.type === 'Lab' && item.staffName?.toLowerCase().includes('snehal joshi')) {
          const currentLabs = newDivSchedule.filter(s => s.type === 'Lab' && s.staffName?.toLowerCase().includes('snehal joshi')).length;
          if (currentLabs >= 1) continue; 
        }

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

            if (!isStaffBusy(item.staffId, day, timeSlot.label, currentSchedule, targetSem, item.type)) {
              validStaffId = item.staffId;
              validStaffName = item.staffName;
            } else if (item.type === 'Lab') {
              const sub = findLabSubstitute(day, timeSlot.label, currentSchedule, targetSem);
              if (sub && !isStaffBusy(sub.id, day, timeSlot.label, currentSchedule, targetSem, 'Lab')) {
                validStaffId = sub.id;
                validStaffName = sub.name;
              }
            }

            if (!validStaffId) continue;
            let score = Math.random() * 5;
            if (isSaturday) score += isMinor ? 500 : -200;
            else if (isMinor) score -= 100;

            if (item.type === 'Lab' && isLabAligning(day, timeSlot.label)) score += 1000;
            score += sIdx * 5;

            const dayClasses = newDivSchedule.filter(s => s.day === day);
            if (dayClasses.length > 0) {
              const indices = dayClasses.map(c => activeSlots.findIndex((a: any) => a.label === c.time));
              const minIdx = Math.min(...indices);
              const maxIdx = Math.max(...indices);
              if (sIdx !== minIdx - 1 && sIdx !== maxIdx + 1) continue;
            }

            let hasSameSubjectAdjacent = false;
            if (sIdx > 0) {
              const prevClass = dayClasses.find(s => s.time === activeSlots[sIdx - 1].label);
              if (prevClass?.subject === item.subject) hasSameSubjectAdjacent = true;
            }
            if (sIdx < activeSlots.length - 1) {
              const nextClass = dayClasses.find(s => s.time === activeSlots[sIdx + 1].label);
              if (nextClass?.subject === item.subject) hasSameSubjectAdjacent = true;
            }

            if (!isSaturday && dayClasses.length === 0) score += 2000;
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
      else if (newDivSchedule.length > bestSchedule.length) bestSchedule = newDivSchedule;
    }

    if (!foundPerfect) {
      let finalSchedule = [...bestSchedule];
      for (const missingItem of pool) {
        const currentCount = finalSchedule.filter(s => s.subject === missingItem.subject && s.type === missingItem.type).length;
        const targetCount = pool.filter(p => p.subject === missingItem.subject && p.type === missingItem.type).length;
        if (currentCount < targetCount) {
          let placed = false;
          for (let dIdx = 0; dIdx < 6 && !placed; dIdx++) {
            const day = this.days[dIdx];
            for (const timeSlot of activeSlots) {
              if (!finalSchedule.some(s => s.day === day && s.time === timeSlot.label)) {
                finalSchedule.push({ id: Math.random().toString(), day, time: timeSlot.label, sem: targetSem, div: targetDiv, staffId: missingItem.staffId, staffName: missingItem.staffName, subject: missingItem.subject, type: missingItem.type, roomName: missingItem.room });
                placed = true; break;
              }
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
    if (foundPerfect) alert("Perfect Timetable Generated!");
    else alert(`Placed ${bestSchedule.length} out of ${pool.length} classes.`);
  }

  async generateMassTimetable(type: 'odd' | 'even') {
    const targetSemesters = type === 'odd' ? [1, 3, 5] : [2, 4, 6];
    const divisions = ['A', 'B', 'C'];
    this.isGenerating.set(true);

    const allExistingSlots = [...this.timetableSource.value];
    const otherSemsSlots = allExistingSlots.filter(s => !targetSemesters.includes(s.sem));

    const globalPools: Record<string, any[]> = {};
    let totalClasses = 0;
    const configuredDivs: { sem: number, div: string }[] = [];

    for (const sem of targetSemesters) {
      for (const div of divisions) {
        const key = `${sem}_${div}`;
        const config = this.roomConfigs().find(c => c.semester === sem && c.division === div);
        const subjects = this.allSubjects().filter(sub => sub.semester === sem && (sub.allowedDivisions || []).includes(div));
        if (subjects.length === 0) continue;

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

    if (totalClasses === 0) { this.isGenerating.set(false); return; }

    const isStaffBusy = (staffId: string, day: string, timeLabel: string, schedule: any[], sem: number, type: string) => {
      if (!staffId) return false;
      if (schedule.some(s => s.day === day && s.time === timeLabel && s.staffId === staffId)) return true;
      return type === 'Lecture' ? !this.isStaffAvailable(staffId, sem, timeLabel) : false;
    };
    const isRoomBusy = (roomName: string, day: string, timeLabel: string, schedule: any[]) => roomName && schedule.some(s => s.day === day && s.time === timeLabel && s.roomName === roomName);
    const findLabSubstitute = (day: string, timeLabel: string, schedule: any[], sem: number) => {
      return this.staffList().find(st => {
        if (st.name?.toLowerCase().includes('snehal joshi')) return false;
        const primarySub = this.allSubjects().find(s => s.divisionStaff?.A === st.id || s.divisionStaff?.B === st.id || s.divisionStaff?.C === st.id);
        const dept = (primarySub?.department || '').toUpperCase().trim();
        const restricted = ['MATHEMATICS', 'MATHS', 'AEC', 'VAC', 'SEC', 'COMMUNICATIONS', 'COMM', 'ENGLISH'];
        return !restricted.includes(dept) && !isStaffBusy(st.id, day, timeLabel, schedule, sem, 'Lab');
      });
    };
    const isLabAligning = (sem: number, day: string, timeLabel: string, schedule: any[]) => schedule.some(s => s.sem === sem && s.type === 'Lab' && s.day === day && s.time === timeLabel);

    const minorTypes = ['AEC', 'SEC', 'VAC', 'MINOR'];
    let bestGlobalSchedule: any[] = [];
    let foundPerfect = false;

    for (let restart = 0; restart < 1000; restart++) {
      let currentGlobalSchedule = [...otherSemsSlots];
      let newGlobalSchedule: any[] = [];
      let globalSuccess = true;
      const shuffledDivs = [...configuredDivs].sort(() => Math.random() - 0.5);

      for (const target of shuffledDivs) {
        const { sem, div } = target;
        const key = `${sem}_${div}`;
        const activeSlots = this.getTimeSlotsForSem(sem).filter((s: any) => !s.isRecess);
        let divSchedule: any[] = [];
        let divSuccess = true;

        for (const item of globalPools[key]) {
          if (item.type === 'Lab' && item.staffName?.toLowerCase().includes('snehal joshi')) {
            if (divSchedule.filter(s => s.type === 'Lab' && s.staffName?.toLowerCase().includes('snehal joshi')).length >= 1) continue;
          }
          let validOptions: { day: string, slotLabel: string, score: number, staffId: string, staffName: string }[] = [];
          for (let dIdx = 0; dIdx < 6; dIdx++) {
            const day = this.days[dIdx];
            if (item.type === 'Lecture' && divSchedule.some(s => s.day === day && s.subject === item.subject)) continue;
            if (item.type === 'Lab' && divSchedule.filter(s => s.day === day && s.type === 'Lab').length >= 2) continue;
            for (let sIdx = 0; sIdx < activeSlots.length; sIdx++) {
              const timeSlot = activeSlots[sIdx];
              if (divSchedule.some(s => s.day === day && s.time === timeSlot.label)) continue;
              if (isRoomBusy(item.room, day, timeSlot.label, currentGlobalSchedule)) continue;

              let vId = '', vName = '';
              if (!isStaffBusy(item.staffId, day, timeSlot.label, currentGlobalSchedule, sem, item.type)) {
                vId = item.staffId; vName = item.staffName;
              } else if (item.type === 'Lab') {
                const sub = findLabSubstitute(day, timeSlot.label, currentGlobalSchedule, sem);
                if (sub && !isStaffBusy(sub.id, day, timeSlot.label, currentGlobalSchedule, sem, 'Lab')) {
                  vId = sub.id; vName = sub.name;
                }
              }

              if (!vId) continue;
              let score = Math.random() * 5 + (sIdx * 5);
              if (day === 'Saturday') score += minorTypes.includes(item.subType) ? 500 : -200;
              if (item.type === 'Lab' && isLabAligning(sem, day, timeSlot.label, currentGlobalSchedule)) score += 1000;

              const dayClasses = divSchedule.filter(s => s.day === day);
              if (dayClasses.length > 0) {
                const indices = dayClasses.map(c => activeSlots.findIndex((a: any) => a.label === c.time));
                const minIdx = Math.min(...indices), maxIdx = Math.max(...indices);
                if (sIdx !== minIdx - 1 && sIdx !== maxIdx + 1) continue;
              }
              validOptions.push({ day, slotLabel: timeSlot.label, score, staffId: vId, staffName: vName });
            }
          }
          if (validOptions.length === 0) { divSuccess = false; break; }
          validOptions.sort((a, b) => b.score - a.score);
          const best = validOptions[0];
          const nSlot = { id: Math.random().toString(), day: best.day, time: best.slotLabel, sem, div, staffId: best.staffId, staffName: best.staffName, subject: item.subject, type: item.type, roomName: item.room };
          divSchedule.push(nSlot); currentGlobalSchedule.push(nSlot); newGlobalSchedule.push(nSlot);
        }
        if (!divSuccess) { globalSuccess = false; break; }
      }
      if (globalSuccess) { foundPerfect = true; bestGlobalSchedule = newGlobalSchedule; break; }
      else if (newGlobalSchedule.length > bestGlobalSchedule.length) bestGlobalSchedule = newGlobalSchedule;
    }

    const old = allExistingSlots.filter(s => targetSemesters.includes(s.sem));
    for (const slotDoc of old) if (slotDoc.id) await this.fb.deleteDocument(FirebaseCollections.Timetable, slotDoc.id);
    for (const slotDoc of bestGlobalSchedule) {
      const { id, ...cleanSlot } = slotDoc;
      await this.fb.addDocument(FirebaseCollections.Timetable, cleanSlot);
    }
    this.isGenerating.set(false);
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
    if (h > 0 && h <= 6) h += 12;
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
