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
  timeSlots = signal<string[]>([]);

  days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  constructor(
    private firebaseService: FirebaseService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) { }

  ngOnInit(): void { }

  timeToMinutes(t: string) {
    const [time, modifier] = t.split(' ');
    let [hours, minutes] = time.split(':').map(Number);

    if (modifier === 'PM' && hours !== 12) hours += 12;
    if (modifier === 'AM' && hours === 12) hours = 0;

    return hours * 60 + minutes;
  }

  fetchTimetable() {
    if (!this.selectedSem() || !this.selectedDiv()) return;

    const semValue = Number(this.selectedSem());

    this.firebaseService.getFilteredCollection<any>('Timetable', 'sem', semValue)
      .subscribe(data => {
        const filtered = data.filter(item => item.div === this.selectedDiv());

        const grid: any = {};
        const times = new Set<string>();

        // Always add break time so it shows up beautifully in the grid
        times.add('01:30 PM - 02:00 PM');

        filtered.forEach(item => {
          const cleanTime = item.time?.trim();
          if (cleanTime && item.day) {
            times.add(cleanTime);
            if (!grid[cleanTime]) {
              grid[cleanTime] = {};
            }
            grid[cleanTime][item.day] = item;
          }
        });

        const sortedTimes = Array.from(times).sort((a: any, b: any) => {
          const startA = a.split(' - ')[0];
          const startB = b.split(' - ')[0];
          return this.timeToMinutes(startA) - this.timeToMinutes(startB);
        });

        this.timeSlots.set(sortedTimes);
        this.timetableGrid.set(grid);
      });
  }
}
