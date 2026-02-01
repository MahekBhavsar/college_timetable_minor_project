import { Component, inject, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FirebaseService } from '../services/firebaseservice';
import { toSignal } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-academic-planner',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './academic-planner.html',
  styleUrl: './academic-planner.css'
})
export class AcademicPlanner {
  private fb = inject(FirebaseService);

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
    // Project fields (optional)
    hasProject: false,
    intProjectVivaStart: '', intProjectVivaEnd: '',
    extProjectVivaStart: '', extProjectVivaEnd: '',
  };

  // Fetch all planners from Firebase
  allPlanners = toSignal(this.fb.getCollection<any>('academic_planner' as any), { initialValue: [] });

  constructor() {
    // When semester changes, load existing data if available
    effect(() => {
      const existing = this.allPlanners().find(p => p.semester === this.selectedSem());
      if (existing) {
        this.plannerData = { ...existing };
      } else {
        this.resetForm();
      }
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
      hasProject: this.selectedSem() === 6, // Default true for Sem 6
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