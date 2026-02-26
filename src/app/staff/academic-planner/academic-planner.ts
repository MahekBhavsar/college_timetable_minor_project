import { Component, OnInit, signal, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser, CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs'; // Essential for async/await with Firebase
import { FirebaseService } from '../../services/firebaseservice';
import { FirebaseCollections } from '../../services/firebase-enums';

@Component({
  selector: 'app-academic-planner-view',
  standalone: true,
  imports: [CommonModule, FormsModule], // Ensure FormsModule is here for ngModel
  templateUrl: './academic-planner.html',
  styleUrls: ['./academic-planner.css']
})
export class AcademicPlannerView implements OnInit {
  allSemesters = [1, 2, 3, 4, 5, 6];
  selectedSemester = signal<number>(1);
  planner = signal<any>(null);
  isLoading = signal(false);

  constructor(
    private firebaseService: FirebaseService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      const stored = localStorage.getItem('portal_user');
      if (stored) {
        try {
          const user = JSON.parse(stored);
          const userSem = Number(user.semester);
          if (!isNaN(userSem)) {
            this.selectedSemester.set(userSem);
          }
        } catch (e) {
          console.error("Error parsing stored user", e);
        }
      }
      this.loadPlanner(this.selectedSemester());
    }
  }

  async loadPlanner(sem: any) {
    const semNum = Number(sem);
    if (isNaN(semNum)) return;

    this.selectedSemester.set(semNum);
    this.isLoading.set(true);

    try {
      // Fetching the planner for the selected semester
      const data = await firstValueFrom(
        this.firebaseService.getFilteredCollection<any>(
          FirebaseCollections.academic_planner, 
          'semester', 
          semNum
        )
      );
      
      this.planner.set(data && data.length > 0 ? data[0] : null);
    } catch (err) {
      console.error("Error loading planner:", err);
      this.planner.set(null);
    } finally {
      this.isLoading.set(false);
    }
  }
}