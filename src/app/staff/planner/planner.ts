import { Component, OnInit, signal, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser, CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { FirebaseService } from '../../services/firebaseservice';
import { FirebaseCollections } from '../../services/firebase-enums';
import { firstValueFrom } from 'rxjs';
import { StaffLayoutComponent } from '../staff-layout/staff-layout';

interface Unit {
  name: string;
  topics: string[];
}

@Component({
  selector: 'app-teacher-planner',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, StaffLayoutComponent],
  templateUrl: './planner.html',
  styleUrls: ['./planner.css']
})
export class TeacherPlanner implements OnInit {
  staffUser = signal<any>(null);
  assignedSubjects = signal<string[]>([]);

  // Input signals
  units = signal<Unit[]>([{ name: '', topics: [''] }]);
  selectedSubject = signal<string>('');
  startDate = signal<string>('');
  endDate = signal<string>('');

  // Output signal (The Schedule)
  generatedPlan = signal<any[]>([]);

  publicHolidays = ['2026-01-26', '2026-03-13', '2026-08-15', '2026-10-02'];

  constructor(
    private firebaseService: FirebaseService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) { }

  async ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      const storedData = localStorage.getItem('portal_user');
      if (storedData) {
        const user = JSON.parse(storedData);
        this.staffUser.set(user);
        await this.loadAssignedSubjects(user.name);
      }
    }
  }

  // --- DATA SYNC ---

  async onSubjectSelect() {
    if (this.selectedSubject()) await this.loadSavedPlan();
  }

  async loadSavedPlan() {
    const user = this.staffUser();
    const subject = this.selectedSubject();
    if (!user?.name || !subject) return;

    try {
      const data = await firstValueFrom(
        this.firebaseService.getFilteredCollection<any>(FirebaseCollections.personal_planner, 'staffName', user.name)
      );
      const subjectPlan = data.find(doc => doc.subject === subject);
      if (subjectPlan) {
        this.generatedPlan.set(subjectPlan.plan || []);
        if (subjectPlan.units) this.units.set(subjectPlan.units);
        if (subjectPlan.startDate) this.startDate.set(subjectPlan.startDate);
        if (subjectPlan.endDate) this.endDate.set(subjectPlan.endDate);
      } else {
        this.generatedPlan.set([]);
        this.units.set([{ name: '', topics: [''] }]);
        this.startDate.set('');
        this.endDate.set('');
      }
    } catch (err) { console.error("Fetch Error:", err); }
  }

  async saveToCloud(isSilent: boolean = false) {
    const plan = this.generatedPlan();
    const subject = this.selectedSubject();
    const user = this.staffUser();

    if (!user?.name || !subject || plan.length === 0) {
      if (!isSilent) alert('No plan to save.');
      return;
    }

    const data = {
      staffName: user.name,
      subject: subject,
      plan: plan,
      units: this.units(),
      startDate: this.startDate(),
      endDate: this.endDate(),
      lastUpdated: new Date().toISOString()
    };

    try {
      const existing = await firstValueFrom(
        this.firebaseService.getFilteredCollection<any>(FirebaseCollections.personal_planner, 'staffName', user.name)
      );
      const existingDoc = existing.find(doc => doc.subject === subject);

      if (existingDoc?.id) {
        await this.firebaseService.updateDocument(FirebaseCollections.personal_planner, existingDoc.id, data);
      } else {
        await this.firebaseService.addDocument(FirebaseCollections.personal_planner, data);
      }
      if (!isSilent) alert('Plan Saved Successfully!');
    } catch (err) { console.error("Save error:", err); }
  }

  // --- GENERATION LOGIC ---

  generateStepByStepPlan() {
    if (!this.selectedSubject() || !this.startDate() || !this.endDate()) return alert("Select Subject & Dates");

    let topicQueue: any[] = [];
    this.units().forEach(u => u.topics.forEach(t => {
      if (t.trim()) topicQueue.push({ u: u.name || 'Unit', t });
    }));

    if (topicQueue.length === 0) return alert("Add topics first!");

    const existingPlan = this.generatedPlan();
    if (existingPlan.length > 0) {
      if (!confirm('Regenerating will recreate topics from the Syllabus structure. Custom rows, remarks, and completion dates are preserved, but previously deleted topics may reappear. Continue?')) {
        return;
      }
    }

    let current = new Date(this.startDate());
    const end = new Date(this.endDate());
    let plan: any[] = [];
    let idx = 0;

    while (current <= end && idx < topicQueue.length) {
      const dStr = current.toISOString().split('T')[0];
      if (current.getDay() !== 0 && !this.publicHolidays.includes(dStr)) {
        const u = topicQueue[idx].u;
        const t = topicQueue[idx].t;

        const existingRow = existingPlan.find(item => item.unit === u && item.topic === t && !item.isCustom);

        plan.push({
          plannedDate: new Date(current).toLocaleDateString('en-IN'),
          dateObj: dStr,
          day: current.toLocaleDateString('en-IN', { weekday: 'long' }),
          unit: u,
          topic: t,
          actualDate: existingRow?.actualDate || '',
          remark: existingRow?.remark || '',
          isDone: existingRow?.isDone || false,
          isCustom: false
        });
        idx++;
      }
      current.setDate(current.getDate() + 1);
    }

    // Append any custom rows that were manually added before
    const customRows = existingPlan.filter(row => row.isCustom);
    plan = [...plan, ...customRows];

    this.generatedPlan.set(plan);
    this.saveToCloud(true);
  }

  addCustomRow() {
    const currentList = [...this.generatedPlan()];
    currentList.push({
      plannedDate: 'Custom',
      dateObj: new Date().toISOString().split('T')[0],
      day: 'N/A',
      unit: '',
      topic: '',
      actualDate: '',
      remark: '',
      isDone: false,
      isCustom: true
    });
    this.generatedPlan.set(currentList);
    this.saveToCloud(true);
  }

  // --- ACTION METHODS ---

  updateField(index: number, field: string, value: any) {
    const current = [...this.generatedPlan()];
    current[index][field] = value;
    if (field === 'actualDate') current[index].isDone = !!value;
    this.generatedPlan.set(current);
    this.saveToCloud(true); // Auto-save on every change
  }

  deleteRow(index: number) {
    if (confirm('Delete this row?')) {
      this.generatedPlan.set(this.generatedPlan().filter((_, i) => i !== index));
      this.saveToCloud(true);
    }
  }

  // --- UNIT/TOPIC MANAGEMENT ---

  refreshUnits() { this.units.set([...this.units()]); }

  addUnit() { this.units.update(u => [...u, { name: '', topics: [''] }]); }

  removeUnit(idx: number) { this.units.update(u => u.filter((_, i) => i !== idx)); }

  addTopic(uIdx: number) {
    const u = [...this.units()];
    u[uIdx].topics.push('');
    this.units.set(u);
  }

  removeTopic(uIdx: number, tIdx: number) {
    const u = [...this.units()];
    u[uIdx].topics = u[uIdx].topics.filter((_, i) => i !== tIdx);
    this.units.set(u);
  }

  async loadAssignedSubjects(name: string) {
    try {
      const data = await firstValueFrom(this.firebaseService.getFilteredCollection<any>(FirebaseCollections.Timetable, 'staffName', name));
      this.assignedSubjects.set([...new Set(data.map(item => item.subject))]);
    } catch (err) { console.error(err); }
  }
}