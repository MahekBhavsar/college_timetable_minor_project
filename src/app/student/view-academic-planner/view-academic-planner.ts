import { Component, OnInit, signal, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser, CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { FirebaseService } from '../../services/firebaseservice';
import { FirebaseCollections } from '../../services/firebase-enums';
import { StudentNavbar } from '../student-navbar/student-navbar';

@Component({
  selector: 'app-academic-planner-view',
  standalone: true,
  imports: [CommonModule, FormsModule,StudentNavbar],
  templateUrl: './view-academic-planner.html',
  styleUrls: ['./view-academic-planner.css']
})
export class ViewAcademicPlanner implements OnInit {

  selectedSemester = signal<number>(0);
  planner = signal<any>(null);
  isLoading = signal<boolean>(false);

  constructor(
    private firebaseService: FirebaseService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  ngOnInit() {
    if (!isPlatformBrowser(this.platformId)) return;

    const storedUser = localStorage.getItem('portal_user');

    if (!storedUser) return;

    try {
      const user = JSON.parse(storedUser);

      if (user?.semester) {
        const userSem = Number(user.semester);

        if (!isNaN(userSem)) {
          this.selectedSemester.set(userSem);
          this.loadPlanner(userSem);
        }
      }

    } catch (error) {
      console.error('Error parsing user data:', error);
    }
  }

  async loadPlanner(semester: number) {
    if (!semester) return;

    this.isLoading.set(true);

    try {
      const data = await firstValueFrom(
        this.firebaseService.getFilteredCollection<any>(
          FirebaseCollections.academic_planner,
          'semester',
          semester
        )
      );

      this.planner.set(data?.length ? data[0] : null);

    } catch (error) {
      console.error('Error loading planner:', error);
      this.planner.set(null);

    } finally {
      this.isLoading.set(false);
    }
  }
}