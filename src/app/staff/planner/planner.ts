import { Component, OnInit, signal, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser, CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { FirebaseService } from '../../services/firebaseservice';
import { FirebaseCollections } from '../../services/firebase-enums';
import { firstValueFrom } from 'rxjs';

interface Unit {
  name: string;
  topics: string[];
}

@Component({
  selector: 'app-teacher-planner',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './planner.html',
  styleUrls: ['./planner.css']
})
export class TeacherPlanner implements OnInit {
  staffUser = signal<any>(null);
  assignedSubjects = signal<string[]>([]);
  
  units = signal<Unit[]>([{ name: '', topics: [''] }]);
  
  selectedSubject = signal<string>('');
  startDate = signal<string>('');
  endDate = signal<string>('');
  generatedPlan = signal<any[]>([]);

  publicHolidays = ['2026-01-26', '2026-03-13', '2026-08-15', '2026-10-02'];

  constructor(
    private firebaseService: FirebaseService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  async ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      const storedData = localStorage.getItem('staff_user');
      if (storedData) {
        const user = JSON.parse(storedData);
        this.staffUser.set(user);
        await this.loadAssignedSubjects(user.name);
      }
    }
  }

  // --- PERSISTENCE: Load & Save ---

  async onSubjectSelect() {
    if (this.selectedSubject()) {
      await this.loadSavedPlan();
    }
  }

  async loadSavedPlan() {
    const user = this.staffUser();
    const subject = this.selectedSubject();

    if (!user?.name || !subject) return;

    try {
      const data = await firstValueFrom(
        this.firebaseService.getFilteredCollection<any>(
          FirebaseCollections.personal_planner, 
          'staffName', 
          user.name
        )
      );

      const subjectPlan = data.find(doc => doc.subject === subject);
      if (subjectPlan && subjectPlan.plan) {
        this.generatedPlan.set(subjectPlan.plan);
      } else {
        this.generatedPlan.set([]); 
      }
    } catch (err) {
      console.error("Fetch Error:", err);
    }
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
    } catch (err) {
      console.error("Save error:", err);
      if (!isSilent) alert('Save failed.');
    }
  }

  // --- UI & GENERATION LOGIC ---

  async loadAssignedSubjects(name: string) {
    try {
      const data = await firstValueFrom(
        this.firebaseService.getFilteredCollection<any>(FirebaseCollections.Timetable, 'staffName', name)
      );
      this.assignedSubjects.set([...new Set(data.map(item => item.subject))]);
    } catch (err) { console.error(err); }
  }

  generateStepByStepPlan() {
    if (!this.selectedSubject() || !this.startDate() || !this.endDate()) return alert("Select Subject & Dates");

    let topicQueue: any[] = [];
    this.units().forEach(u => u.topics.forEach(t => t.trim() && topicQueue.push({u: u.name || 'Unit', t})));

    let current = new Date(this.startDate());
    const end = new Date(this.endDate());
    let plan: any[] = [];
    let idx = 0;

    while (current <= end && idx < topicQueue.length) {
      const dStr = current.toISOString().split('T')[0];
      if (current.getDay() !== 0 && !this.publicHolidays.includes(dStr)) {
        plan.push({
          plannedDate: new Date(current).toLocaleDateString('en-IN'),
          dateObj: dStr,
          day: current.toLocaleDateString('en-IN', { weekday: 'long' }),
          unit: topicQueue[idx].u,
          topic: topicQueue[idx].t,
          actualDate: '',
          isDone: false
        });
        idx++;
      }
      current.setDate(current.getDate() + 1);
    }
    this.generatedPlan.set(plan);
  }

  updateProgress(index: number, date: string) {
    const current = [...this.generatedPlan()];
    current[index].actualDate = date;
    current[index].isDone = !!date;
    this.generatedPlan.set(current);
    this.saveToCloud(true);
  }

  // --- FIXED: UNIT/TOPIC METHODS ---

  refreshUnits() {
    this.units.set([...this.units()]);
  }

  addUnit() {
    this.units.update(u => [...u, { name: '', topics: [''] }]);
  }

  removeUnit(idx: number) {
    this.units.update(u => u.filter((_, i) => i !== idx));
  }

  addTopic(uIdx: number) {
    const u = this.units();
    u[uIdx].topics.push('');
    this.refreshUnits();
  }

  removeTopic(uIdx: number, tIdx: number) {
    const u = this.units();
    u[uIdx].topics = u[uIdx].topics.filter((_, i) => i !== tIdx);
    this.refreshUnits();
  }
}