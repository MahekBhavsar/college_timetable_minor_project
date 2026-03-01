import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FirebaseService } from '../services/firebaseservice';
import { FirebaseCollections } from '../services/firebase-enums';
import { firstValueFrom } from 'rxjs';
import { AdminLayoutComponent } from '../admin-layout/admin-layout';

@Component({
  selector: 'app-admin-manage-student',
  standalone: true,
  imports: [CommonModule, AdminLayoutComponent],
  templateUrl: './admin-manage-students.html'
})
export class AdminManageStudent implements OnInit {

  students = signal<any[]>([]);
  isProcessing = signal(false);
  selectedSemester = signal<number>(1);

  constructor(private firebaseService: FirebaseService) { }

  ngOnInit() {
    this.loadAll();
  }

  // ================= LOAD =================
  loadAll() {
    this.firebaseService.getCollection<any>(FirebaseCollections.Application)
      .subscribe(data => this.students.set(data));
  }

  // ================= FILTER + SORT =================
  filteredStudents = computed(() => {
    return this.students()
      .filter(s => Number(s.semester) === this.selectedSemester())
      .sort((a, b) => (a.rollNo || 9999) - (b.rollNo || 9999));
  });

  setSemester(sem: number) {
    this.selectedSemester.set(sem);
  }

  // ================= DELETE =================
  async deleteStudent(id: string) {
    if (!confirm("Delete student permanently?")) return;

    this.isProcessing.set(true);
    try {
      await this.firebaseService.deleteDocument(FirebaseCollections.Application, id);
      this.loadAll();
    } finally {
      this.isProcessing.set(false);
    }
  }

  // ================= MASTER SORT =================
  async generateMasterRoll(sem: number) {

    if (!confirm(`Generate roll numbers for Semester ${sem}?`)) return;

    this.isProcessing.set(true);

    try {
      const all = await firstValueFrom(
        this.firebaseService.getCollection<any>(FirebaseCollections.Application)
      );

      let approved = all.filter(
        a => Number(a.semester) === sem && a.status === 'Application approved by staff'
      );

      if (approved.length === 0) {
        alert("No approved students found");
        return;
      }

      // Sort by name
      approved = approved.sort((a, b) => a.name.localeCompare(b.name));

      // ================= DIVISION CAPACITY LOGIC =================
      // Each division max 75 students
      approved.forEach((s, i) => {

        let divisionIndex = Math.floor(i / 75); // 0=A,1=B,2=C
        let division = 'C';

        if (divisionIndex === 0) division = 'A';
        else if (divisionIndex === 1) division = 'B';
        else division = 'C';

        s.division = division;
        s.rollNo = i + 1;
      });


      // ================= SEM 3-6 ELECTIVE GROUPING =================
      if (sem >= 3) {

        const android = approved.filter(s => s.elective === 'Android');
        const web = approved.filter(s => s.elective === 'Web Development');
        const ai = approved.filter(s => s.elective === 'AI & ML');
        const others = approved.filter(
          s => s.elective !== 'Android' &&
            s.elective !== 'Web Development' &&
            s.elective !== 'AI & ML'
        );

        approved = [...android, ...web, ...ai, ...others];

        // Reassign roll continuous after grouping
        approved.forEach((s, i) => {
          let divisionIndex = Math.floor(i / 75);

          if (divisionIndex === 0) s.division = 'A';
          else if (divisionIndex === 1) s.division = 'B';
          else s.division = 'C';

          s.rollNo = i + 1;
        });
      }

      // ================= SAVE =================
      for (let s of approved) {
        await this.firebaseService.updateDocument(
          FirebaseCollections.Application,
          s.id,
          {
            division: s.division,
            rollNo: s.rollNo
          }
        );
      }

      alert("Division generated based on 75 seat capacity!");

    } finally {
      this.isProcessing.set(false);
      this.loadAll();
    }
  }


  // ================= PROMOTE =================
  async promoteStudents(currentSem: number) {

    if (!confirm(`Promote Semester ${currentSem} students?`)) return;

    this.isProcessing.set(true);

    try {
      const list = this.students().filter(s => Number(s.semester) === currentSem);

      for (let s of list) {
        await this.firebaseService.updateDocument(
          FirebaseCollections.Application,
          s.id,
          {
            semester: currentSem + 1,
            division: 'TBA',
            rollNo: 0
          }
        );
      }

      alert("Students promoted!");

    } finally {
      this.isProcessing.set(false);
      this.loadAll();
    }
  }
}
