import { Component, OnInit, signal, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser, CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { FirebaseService } from '../../services/firebaseservice';
import { SidebarComponent } from '../sidebar-component/sidebar-component';

@Component({
  selector: 'app-staff-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, SidebarComponent],
  templateUrl: './staff-dashboard.html',
  styleUrls: ['./staff-dashboard.css']
})
export class StaffDashboard implements OnInit {
  staffUser = signal<any>(null);
  isCollapsed = signal<boolean>(false); // FIX for TS2339
  today = new Date();
  
  // Stats
  timetableCount = signal<number>(0);
  assignmentCount = signal<number>(0);
  personalNotes = signal<number>(0);

  constructor(
    private firebaseService: FirebaseService,
    private router: Router,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  // FIX for TS2339: Method to toggle the sidebar state
  toggleMenu() {
    this.isCollapsed.update(val => !val);
  }

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      const storedData = localStorage.getItem('portal_user'); 
      if (storedData) {
        const user = JSON.parse(storedData);
        if (user.role === 'staff') {
          this.staffUser.set(user);
          this.loadStats(user);
        } else {
          this.router.navigate(['/student-login']);
        }
      } else {
        this.router.navigate(['/student-login']);
      }
    }
  }

  loadStats(user: any): void {
    this.firebaseService.getFilteredCollection<any>('Timetable', 'staffName', user.name)
      .subscribe(data => this.timetableCount.set(data.length));
    this.firebaseService.getFilteredCollection<any>('assignments', 'staffName', user.name)
      .subscribe(data => this.assignmentCount.set(data.length));
    this.firebaseService.getFilteredCollection<any>('personal_planner', 'staffName', user.name)
      .subscribe(data => this.personalNotes.set(data.length));
  }

  logout(): void {
    if (isPlatformBrowser(this.platformId)) {
      localStorage.removeItem('portal_user');
      this.router.navigate(['/admin-login']);
    }
  }
}