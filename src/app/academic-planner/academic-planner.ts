import { Component, inject, signal, effect, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminLayoutComponent } from '../admin-layout/admin-layout';
import { FirebaseService } from '../services/firebaseservice';
import { toSignal } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-academic-planner',
  standalone: true,
  imports: [CommonModule, FormsModule, AdminLayoutComponent],
  templateUrl: './academic-planner.html',
  styleUrl: './academic-planner.css'
})
export class AcademicPlanner {
  private fb = inject(FirebaseService);
  private cdr = inject(ChangeDetectorRef);

  // Configuration
  semesters = [1, 2, 3, 4, 5, 6];
  selectedSem = signal(1);
  isSaving = signal(false);

  // Form State
  plannerData = {
    collegeStart: '',
    classAssignmentStart: '', classAssignmentEnd: '',
    homeAssignmentStart: '', homeAssignmentEnd: '',
    classTest1Start: '', classTest1End: '',
    classTest2Start: '', classTest2End: '',
    internalPracticalStart: '', internalPracticalEnd: '',
    externalPracticalStart: '', externalPracticalEnd: '',
    externalTheoryStart: '', externalTheoryEnd: '',
    hasProject: false,
    intProjectVivaStart: '', intProjectVivaEnd: '',
    extProjectVivaStart: '', extProjectVivaEnd: '',
  };

  // Fetch all planners from Firebase
  allPlanners = toSignal(this.fb.getCollection<any>('academic_planner'), { initialValue: [] });

  constructor() {
    // Logic moved to a safe sync method to avoid NG0100 errors
    effect(() => {
      this.syncPlannerData();
    });
  }

  private syncPlannerData() {
    const sem = this.selectedSem();
    const existing = this.allPlanners().find(p => p.semester === sem);

    // setTimeout pushes the update to the next browser tick, resolving lifecycle conflicts
    setTimeout(() => {
      if (existing) {
        this.plannerData = { ...existing };
      } else {
        this.resetForm();
      }
      this.cdr.detectChanges(); // Manually notify Angular of the update
    });
  }

  resetForm() {
    this.plannerData = {
      collegeStart: '',
      classAssignmentStart: '', classAssignmentEnd: '',
      homeAssignmentStart: '', homeAssignmentEnd: '',
      classTest1Start: '', classTest1End: '',
      classTest2Start: '', classTest2End: '',
      internalPracticalStart: '', internalPracticalEnd: '',
      externalPracticalStart: '', externalPracticalEnd: '',
      externalTheoryStart: '', externalTheoryEnd: '',
      hasProject: this.selectedSem() === 6,
      intProjectVivaStart: '', intProjectVivaEnd: '',
      extProjectVivaStart: '', extProjectVivaEnd: '',
    };
  }

  async savePlanner() {
    this.isSaving.set(true);
    const data = {
      ...this.plannerData,
      semester: this.selectedSem(),
      updatedAt: new Date()
    };

    try {
      const existing = this.allPlanners().find(p => p.semester === this.selectedSem());
      if (existing) {
        await this.fb.updateDocument('academic_planner' as any, existing.id, data);
      } else {
        await this.fb.addDocument('academic_planner' as any, data);
      }
      alert(`Academic Planner for Semester ${this.selectedSem()} saved!`);
    } catch (e) {
      console.error(e);
    } finally {
      this.isSaving.set(false);
    }
  }
}