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
  assignmentCount = signal<number>(0); // Added for the new card
  academicEvents = signal<number>(0);
  personalNotes = signal<number>(0);

  constructor(
    private firebaseService: FirebaseService,
    private router: Router,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

 ngOnInit(): void {
  if (isPlatformBrowser(this.platformId)) {
    // 1. Use the correct key from StudentLogin
    const storedData = localStorage.getItem('portal_user'); 
    
    if (storedData) {
      const user = JSON.parse(storedData);
      
      // 2. Double check the role is actually staff
      if (user.role === 'staff') {
        this.staffUser.set(user);
        this.loadStats(user);
      } else {
        // If not staff, go to student-login (which exists in your routes)
        this.router.navigate(['/student-login']);
      }
    } else {
      // 3. FIX: Redirect to a path that actually EXISTS in your routes
      // Use '/student-login' or '/admin/admin-login'
      this.router.navigate(['/student-login']);
    }
  }
}

  loadStats(user: any): void {
    // 1. Own Timetable Count
    this.firebaseService.getFilteredCollection<any>('Timetable', 'staffName', user.name)
      .subscribe(data => this.timetableCount.set(data.length));

    // 2. Published Assignments Count
    this.firebaseService.getFilteredCollection<any>('assignments', 'staffName', user.name)
      .subscribe(data => this.assignmentCount.set(data.length));

    // 3. Academic Planner Check (Filtered by user's semester)
    this.firebaseService.getFilteredCollection<any>('academic_planner', 'semester', Number(user.semester))
      .subscribe(data => this.academicEvents.set(data.length));

    // 4. Personal Notes/Planner
    this.firebaseService.getFilteredCollection<any>('personal_planner', 'staffName', user.name)
      .subscribe(data => this.personalNotes.set(data.length));
  }

  logout(): void {
    if (isPlatformBrowser(this.platformId)) {
      localStorage.removeItem('staff_user');
      this.router.navigate(['/admin-login']);
    }
  }
}