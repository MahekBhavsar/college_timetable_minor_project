import { Component, OnInit, signal, Inject, PLATFORM_ID, computed } from '@angular/core';
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

  // --- Summary Computed Signal ---
  // This automatically recalculates whenever allAssignments updates
  summary = computed(() => {
    const data = this.allAssignments();
    const dayStats: Record<string, { lectures: number; labs: number; total: number }> = {};
    
    // Initialize stats for each day
    this.days.forEach(day => {
      dayStats[day] = { lectures: 0, labs: 0, total: 0 };
    });

    let grandLectures = 0;
    let grandLabs = 0;

    data.forEach(lec => {
      const day = lec.day;
      if (dayStats[day]) {
        if (lec.type === 'Lecture') {
          dayStats[day].lectures++;
          grandLectures++;
        } else if (lec.type === 'Lab') {
          dayStats[day].labs++;
          grandLabs++;
        }
        dayStats[day].total++;
      }
    });

    return {
      dayWise: dayStats,
      grandLectures,
      grandLabs,
      grandTotal: grandLectures + grandLabs
    };
  });

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
    this.firebaseService.getFilteredCollection<any>('Timetable', 'staffName', name)
      .subscribe(data => {
        const sorted = data.sort((a, b) => {
          return this.parseTimeToMinutes(a.time) - this.parseTimeToMinutes(b.time);
        });
        this.allAssignments.set(sorted);
      });
  }

  getLecturesByDay(day: string) {
    return this.allAssignments().filter(a => a.day === day);
  }

  hasConflict(currentLec: any, dayLectures: any[]): boolean {
    return dayLectures.some(lec => 
      lec.id !== currentLec.id && 
      lec.time.trim().toLowerCase() === currentLec.time.trim().toLowerCase()
    );
  }

  private parseTimeToMinutes(timeStr: string): number {
    if (!timeStr) return 0;
    const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
    if (!match) return 0;

    let h = parseInt(match[1], 10);
    const m = parseInt(match[2], 10);
    const modifier = match[3].toUpperCase();

    if (modifier === 'PM' && h < 12) h += 12;
    if (modifier === 'AM' && h === 12) h = 0;

    return h * 60 + m;
  }
}