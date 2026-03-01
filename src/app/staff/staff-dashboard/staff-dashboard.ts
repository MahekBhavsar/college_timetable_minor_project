import { Component, OnInit, signal, Inject, PLATFORM_ID, AfterViewInit, ElementRef, ViewChild, OnDestroy } from '@angular/core';
import { isPlatformBrowser, CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FirebaseService } from '../../services/firebaseservice';
import { StaffLayoutComponent } from '../staff-layout/staff-layout';
import Chart from 'chart.js/auto';
import { combineLatest, Subscription } from 'rxjs';
import { FirebaseCollections } from '../../services/firebase-enums';

@Component({
  selector: 'app-staff-dashboard',
  standalone: true,
  imports: [CommonModule, StaffLayoutComponent],
  templateUrl: './staff-dashboard.html',
  styleUrls: ['./staff-dashboard.css']
})
export class StaffDashboard implements OnInit, AfterViewInit, OnDestroy {
  staffUser = signal<any>(null);

  // Real dates
  currentDate = new Date();
  todayName = this.currentDate.toLocaleDateString('en-US', { weekday: 'long' });
  formattedDate = this.currentDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  // Stats
  timetableCount = signal<number>(0);
  assignmentCount = signal<number>(0);
  personalNotes = signal<number>(0);

  // Extracted Data
  todaysClasses = signal<any[]>([]);
  recentAssignments = signal<any[]>([]);

  @ViewChild('workloadChart') workloadChartRef!: ElementRef;
  private chartInstance: any;
  private subs = new Subscription();

  constructor(
    private fb: FirebaseService,
    private router: Router,
    @Inject(PLATFORM_ID) private platformId: Object
  ) { }

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      const storedData = localStorage.getItem('portal_user');
      if (storedData) {
        const user = JSON.parse(storedData);
        if (user.role === 'staff') {
          this.staffUser.set(user);
          this.loadDashboardData(user);
        } else {
          this.router.navigate(['/student-login']);
        }
      } else {
        this.router.navigate(['/student-login']);
      }
    }
  }

  ngAfterViewInit() {
    // Chart will be initialized once data is loaded (inside loadDashboardData)
  }

  loadDashboardData(user: any): void {
    // Fetch all 3 collections simultaneously
    this.subs.add(
      combineLatest([
        this.fb.getFilteredCollection<any>(FirebaseCollections.Timetable, 'staffId', user.id),
        this.fb.getFilteredCollection<any>('assignments', 'staffId', user.id),
        this.fb.getFilteredCollection<any>('personal_planner', 'staffId', user.id)
      ]).subscribe(([timetable, assignments, notes]) => {

        // 1. Basic Counts
        this.timetableCount.set(timetable.length);
        this.assignmentCount.set(assignments.length);
        this.personalNotes.set(notes.length);

        // 2. Extract Today's Schedule
        const todaySchedule = timetable
          .filter(t => t.day === this.todayName)
          .sort((a, b) => this.timeToMins(a.time) - this.timeToMins(b.time));
        this.todaysClasses.set(todaySchedule);

        // 3. Extract Recent Assignments (Top 4)
        const recent = assignments
          .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
          .slice(0, 4);
        this.recentAssignments.set(recent);

        // 4. Update Chart if in browser
        if (isPlatformBrowser(this.platformId)) {
          this.renderWorkloadChart(timetable);
        }
      })
    );
  }

  renderWorkloadChart(timetable: any[]) {
    if (!this.workloadChartRef) return;

    // Process data to count classes per day
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const counts = days.map(d => timetable.filter(t => t.day === d).length);

    if (this.chartInstance) {
      this.chartInstance.destroy();
    }

    this.chartInstance = new Chart(this.workloadChartRef.nativeElement, {
      type: 'bar',
      data: {
        labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
        datasets: [{
          label: 'Classes Scheduled',
          data: counts,
          backgroundColor: '#0d6efd',
          borderRadius: 6,
          barThickness: 24
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          y: { beginAtZero: true, ticks: { stepSize: 1 } }
        }
      }
    });
  }

  // Helper to sort time (e.g. "09:30 AM")
  private timeToMins(tLabel: string): number {
    if (!tLabel) return 0;
    const parts = tLabel.split(' - ')[0]; // Gets the start time e.g "09:30 AM"
    if (!parts) return 0;
    const [time, modifier] = parts.split(' ');
    if (!time || !modifier) return 0;
    let [hours, minutes] = time.split(':').map(Number);
    if (hours === 12) hours = 0;
    if (modifier.toUpperCase() === 'PM') hours += 12;
    return hours * 60 + minutes;
  }

  logout(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.fb.logout();
      localStorage.removeItem('portal_user');
      this.router.navigate(['/admin-login']);
    }
  }

  ngOnDestroy() {
    this.subs.unsubscribe();
    if (this.chartInstance) {
      this.chartInstance.destroy();
    }
  }
}