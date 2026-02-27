import { Component, OnInit, signal, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser, CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FirebaseService } from '../../services/firebaseservice';

@Component({
  selector: 'app-staff-timetable',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './staff-timetable.html',
  styleUrls: ['./staff-timetable.css']
})
export class StaffTimetable implements OnInit {
  staffUser = signal<any>(null);
  allAssignments = signal<any[]>([]);
  days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  constructor(
    private firebaseService: FirebaseService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      const storedData = localStorage.getItem('portal_user'); 
      if (storedData) {
        const user = JSON.parse(storedData);
        this.staffUser.set(user);
        if (user.name) {
          this.loadAllAvailableLectures(user.name);
        }
      }
    }
  }

  loadAllAvailableLectures(name: string): void {
    // Fetches every assignment across all semesters for this professor
    this.firebaseService.getFilteredCollection<any>('Timetable', 'staffName', name)
      .subscribe(data => {
        // Sort by time so morning lectures appear first
        const sorted = data.sort((a, b) => a.time.localeCompare(b.time));
        this.allAssignments.set(sorted);
      });
  }

  // 🔥 This helper provides the data for each day column
  getLecturesByDay(day: string) {
    return this.allAssignments().filter(a => a.day === day);
  }

  // 🔥 Conflict Detector: Checks for overlapping time slots
  hasConflict(currentLec: any, dayLectures: any[]): boolean {
    return dayLectures.some(lec => 
      lec.id !== currentLec.id && lec.time.trim() === currentLec.time.trim()
    );
  }
}