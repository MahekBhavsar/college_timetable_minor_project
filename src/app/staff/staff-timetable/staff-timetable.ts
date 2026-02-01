import { Component, OnInit, signal, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser, CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FirebaseService } from '../../services/firebaseservice';

@Component({
  selector: 'app-staff-timetable',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './staff-timetable.html',
  styleUrls: ['./staff-timetable.css'] // Use the same CSS as the student view
})
export class StaffTimetable implements OnInit {
  staffUser = signal<any>(null);
  timetableGrid = signal<any>({});
  
  days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  timeSlots = [
    '08:00 AM - 08:50 AM', '08:50 AM - 09:40 AM', '09:40 AM - 10:30 AM',
    '10:30 AM - 11:20 AM', '11:20 AM - 12:10 PM', '12:10 PM - 01:00 PM',
    '01:30 PM - 02:00 PM', '02:00 PM - 02:50 PM', '02:50 PM - 03:40 PM'
  ];

  constructor(
    private firebaseService: FirebaseService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      const storedData = localStorage.getItem('staff_user');
      if (storedData) {
        const user = JSON.parse(storedData);
        this.staffUser.set(user);
        this.loadMyGrid(user.name);
      }
    }
  }

  loadMyGrid(name: string): void {
    this.firebaseService.getFilteredCollection<any>('Timetable', 'staffName', name)
      .subscribe(data => {
        const grid: any = {};
        // Initialize empty grid
        this.timeSlots.forEach(slot => {
          grid[slot] = {};
          this.days.forEach(day => grid[slot][day] = null);
        });

        // Fill grid with personal data
        data.forEach(item => {
          const cleanTime = item.time?.trim();
          if (grid[cleanTime]) {
            grid[cleanTime][item.day] = item;
          }
        });
        this.timetableGrid.set(grid);
      });
  }
}