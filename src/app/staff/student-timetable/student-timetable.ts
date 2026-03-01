import { Component, OnInit, signal, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser, CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { FirebaseService } from '../../services/firebaseservice';
import { StaffLayoutComponent } from '../staff-layout/staff-layout';

@Component({
  selector: 'app-student-timetable',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, StaffLayoutComponent],
  templateUrl: './student-timetable.html',
  styleUrls: ['./student-timetable.css']
})
export class StudentTimetable implements OnInit {
  selectedSem = signal<string>('');
  selectedDiv = signal<string>('');
  timetableGrid = signal<any>({});

  days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  // Ensure these match your Firestore "time" strings EXACTLY
  timeSlots = [
    '08:00 AM - 08:50 AM', '08:50 AM - 09:40 AM', '09:40 AM - 10:30 AM',
    '10:30 AM - 11:20 AM', '11:20 AM - 12:10 PM', '12:10 PM - 01:00 PM',
    '01:30 PM - 02:00 PM', '02:00 PM - 02:50 PM', '02:50 PM - 03:40 PM'
  ];

  constructor(
    private firebaseService: FirebaseService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) { }

  ngOnInit(): void { }

  fetchTimetable() {
    if (!this.selectedSem() || !this.selectedDiv()) return;

    // Convert string "1" to number 1 to match Firestore type
    const semValue = Number(this.selectedSem());

    this.firebaseService.getFilteredCollection<any>('Timetable', 'sem', semValue)
      .subscribe(data => {
        console.log("Raw Data from DB:", data); // Check if this is empty

        const filtered = data.filter(item => item.div === this.selectedDiv());
        console.log("Filtered by Div:", filtered);

        const grid: any = {};
        this.timeSlots.forEach(slot => {
          grid[slot] = {};
          this.days.forEach(day => grid[slot][day] = null);
        });

        filtered.forEach(item => {
          // Careful: if item.time in DB is "08:50 AM - 09:40 AM " (extra space), it won't match
          const cleanTime = item.time?.trim();
          if (grid[cleanTime]) {
            grid[cleanTime][item.day] = item;
          }
        });

        this.timetableGrid.set(grid);
      });
  }
}