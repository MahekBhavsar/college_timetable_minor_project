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

      // 🔍 Updated filter: Include ALL students in the semester
      let approved = all.filter(
        a => Number(a.semester) === sem
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

      // ================= DATA SYNC PREP =================
      // 🔍 Fetch official student list once for faster matching
      const officialStudentsList = await firstValueFrom(this.firebaseService.getCollection<any>('students'));

      // ================= BATCH SAVE (PARALLEL) =================
      const updateTasks = approved.map(async (s) => {
        try {
          // 1. Update Registry
          await this.firebaseService.updateDocument(
            FirebaseCollections.Application,
            s.id,
            { division: s.division, rollNo: s.rollNo }
          );

          // 2. Sync to official 'students' collection
          const officialDoc = officialStudentsList.find(os => 
            os.email?.trim().toLowerCase() === s.email?.trim().toLowerCase()
          );

          if (officialDoc) {
            await this.firebaseService.updateDocument(
              'students' as any,
              officialDoc.id,
              { division: s.division, rollNo: s.rollNo }
            );
          }
        } catch (studentErr) {
          console.error(`❌ Failed to process student ${s.name}:`, studentErr);
        }
      });

      // Execute all updates simultaneously
      await Promise.all(updateTasks);

      alert("Division generated based on 75 seat capacity!");

    } finally {
      this.isProcessing.set(false);
      this.loadAll();
    }
  }


  // ================= PROMOTE (ALL) =================
  async promoteStudents(currentSem: number) {
    const nextSem = currentSem + 1;
    if (nextSem > 6) {
      alert("These students are already in the final semester.");
      return;
    }

    if (!confirm(`Promote ALL Semester ${currentSem} students to Semester ${nextSem}?`)) return;

    this.isProcessing.set(true);
    try {
      const list = this.students().filter(s => Number(s.semester) === currentSem);
      for (let s of list) {
        const updateData = {
          semester: nextSem,
          division: 'TBA',
          rollNo: 0
        };

        // Update Registry
        await this.firebaseService.updateDocument(
          FirebaseCollections.Application,
          s.id,
          updateData
        );

        // 🔍 Sync to official 'students' collection (hardened matching)
        const students = await firstValueFrom(
          this.firebaseService.getFilteredCollection<any>('students', 'email', s.email.trim().toLowerCase())
        );
        if (students.length > 0) {
          await this.firebaseService.updateDocument(
            'students' as any,
            students[0].id,
            updateData
          );
        }
      }
      this.loadAll();
      alert(`All Semester ${currentSem} students promoted!`);
    } catch (e) {
      console.error(e);
      alert("Promotion failed");
    } finally {
      this.isProcessing.set(false);
    }
  }


  // ================= INDIVIDUAL PROMOTE =================
  async promoteIndividual(s: any) {
    const nextSem = Number(s.semester) + 1;
    if (nextSem > 6) {
      alert("Student is already in the final semester.");
      return;
    }

    if (!confirm(`Promote ${s.name} to Semester ${nextSem}?`)) return;

    this.isProcessing.set(true);
    try {
      const updateData = {
        semester: nextSem,
        division: 'TBA',
        rollNo: 0
      };

      // Update Registry
      await this.firebaseService.updateDocument(
        FirebaseCollections.Application,
        s.id,
        updateData
      );

      // 🔍 Sync to official 'students' collection (hardened matching)
      const students = await firstValueFrom(
        this.firebaseService.getFilteredCollection<any>('students', 'email', s.email.trim().toLowerCase())
      );
      if (students.length > 0) {
        await this.firebaseService.updateDocument(
          'students' as any,
          students[0].id,
          updateData
        );
      }
      
      this.loadAll();
      alert(`${s.name} promoted to Semester ${nextSem}!`);
    } catch (e) {
      console.error(e);
      alert("Promotion failed");
    } finally {
      this.isProcessing.set(false);
    }
  }
}
