import { Component, OnInit, signal, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser, CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { FirebaseService } from '../../services/firebaseservice';

@Component({
  selector: 'app-staff-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './staff-dashboard.html',
  styleUrls: ['./staff-dashboard.css']
})
export class StaffDashboard implements OnInit {
  staffUser = signal<any>(null);
  timetableCount = signal<number>(0);
  academicEvents = signal<number>(0);
  personalNotes = signal<number>(0);

  constructor(
    private firebaseService: FirebaseService,
    private router: Router,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      const storedData = localStorage.getItem('staff_user');
      if (storedData) {
        const user = JSON.parse(storedData);
        this.staffUser.set(user);
        this.loadStats(user.name);
      } else {
        this.router.navigate(['/admin-login']);
      }
    }
  }

  loadStats(name: string): void {
    // 1. Own Timetable Count
    this.firebaseService.getFilteredCollection<any>('Timetable', 'staffName', name)
      .subscribe(data => this.timetableCount.set(data.length));

    // 2. Global Academic Events
    this.firebaseService.getFilteredCollection<any>('academic_planner', 'active', true)
      .subscribe(data => this.academicEvents.set(data.length));

    // 3. Personal Notes/Planner (Specific to this staff)
    this.firebaseService.getFilteredCollection<any>('personal_planner', 'staffName', name)
      .subscribe(data => this.personalNotes.set(data.length));
  }

  logout(): void {
    if (isPlatformBrowser(this.platformId)) {
      localStorage.removeItem('staff_user');
      this.router.navigate(['/admin-login']);
    }
  }
}