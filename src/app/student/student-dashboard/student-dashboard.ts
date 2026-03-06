import { Component, signal, OnInit, Inject, PLATFORM_ID, AfterViewInit, ViewChild, ElementRef, OnDestroy } from '@angular/core';
import { isPlatformBrowser, CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FirebaseService } from '../../services/firebaseservice';
import { FirebaseCollections } from '../../services/firebase-enums';
import { StudentNavbar } from '../student-navbar/student-navbar';
import { firstValueFrom, Subscription } from 'rxjs';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

@Component({
  selector: 'app-student-dashboard',
  standalone: true,
  imports: [CommonModule, StudentNavbar],
  templateUrl: './student-dashboard.html',
  styleUrls: ['./student-dashboard.css']
})
export class StudentDashboard implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('performanceChart') performanceChartRef!: ElementRef<HTMLCanvasElement>;
  chartInstance: Chart | null = null;

  student = signal<any>(null);
  showDropdown = signal(false);

  // Dynamic signals
  isLoading = signal(true);
  pendingTasks = signal<number>(0);
  completedTasks = signal<number>(0);
  upcomingExams = signal<number>(0);
  attendanceScore = signal<number>(85); // Future scope for DB linkage

  notices = signal<any[]>([]);
  dailyPlanner = signal<any[]>([]);

  private sub = new Subscription();

  constructor(
    private firebaseService: FirebaseService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) { }

  async ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      const stored = localStorage.getItem('portal_user');
      if (stored) {
        const user = JSON.parse(stored);
        this.student.set(user);
        await this.loadDashboardData(user);
      } else {
        this.isLoading.set(false);
      }
    }
  }

  ngAfterViewInit() {
    // Wait for the DOM to render before initializing the chart
    setTimeout(() => {
      this.initChart();
    }, 500);
  }

  async loadDashboardData(user: any) {
    this.isLoading.set(true);
    try {
      const semValue = Number(user.semester);
      const divValue = String(user.division);
      const isTBA = !divValue || divValue.toUpperCase() === 'TBA';

      // 1. Fetch Assignments & User specific submissions
      const assignmentFilter = [{ field: 'sem', value: semValue }, { field: 'div', value: divValue }];
      const rawAssignments = await firstValueFrom(
        isTBA
          ? this.firebaseService.getFilteredCollection(FirebaseCollections.assignments, 'sem', semValue)
          : this.firebaseService.getMultipleFilteredCollection(FirebaseCollections.assignments, assignmentFilter)
      ) as any[];

      const userSubmissions = await firstValueFrom(
        this.firebaseService.getFilteredCollection('assignment_submissions' as any, 'studentId', user.rollNo)
      ) as any[];

      const now = new Date();
      let pending = 0;
      let completed = 0;

      rawAssignments.forEach(asg => {
        const hasSubmitted = userSubmissions.some(sub => sub.assignmentId === asg.id);
        if (hasSubmitted) {
          completed++;
        } else {
          pending++;
        }
      });

      this.pendingTasks.set(pending);
      this.completedTasks.set(completed);

      // 2. Fetch Planner (Exams / Events)
      const plannerItems = await firstValueFrom(
        this.firebaseService.getFilteredCollection(FirebaseCollections.academic_planner, 'sem', semValue)
      ) as any[];

      let upcExams = 0;
      const validPlanner = plannerItems.filter(item => {
        if (!item.date) return false;

        // Use local timezone zero-hour for reliable date comparison
        const eDate = new Date(item.date);
        eDate.setHours(0, 0, 0, 0);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (eDate >= today) {
          if (item.type?.toLowerCase().includes('exam') || item.title?.toLowerCase().includes('exam') || item.title?.toLowerCase().includes('test')) upcExams++;
          return true;
        }
        return false;
      }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).slice(0, 5);

      this.upcomingExams.set(upcExams);
      this.dailyPlanner.set(validPlanner);

      // 3. Fetch general Notices
      const allNotices = await firstValueFrom(this.firebaseService.getCollection('notices' as any)) as any[];
      // Safe fallback in case notices collection is empty or missing, just show nothing instead of broken submissions
      this.notices.set((allNotices || []).slice(0, 4));

    } catch (e) {
      console.error("Dashboard Fetch Error", e);
    } finally {
      this.isLoading.set(false);
      // Update chart with newly fetched data
      if (this.chartInstance) {
        this.updateChartData();
      }
    }
  }

  initChart() {
    if (!isPlatformBrowser(this.platformId)) return;
    if (!this.performanceChartRef?.nativeElement) return;

    this.chartInstance = new Chart(this.performanceChartRef.nativeElement, {
      type: 'doughnut',
      data: {
        labels: ['Pending', 'Completed'],
        datasets: [{
          data: [this.pendingTasks(), this.completedTasks()],
          backgroundColor: ['#ef4444', '#10b981'],
          borderWidth: 0,
          hoverOffset: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '75%',
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            backgroundColor: '#1e1e2f',
            titleFont: { size: 14, family: "'Inter', sans-serif" },
            bodyFont: { size: 14, family: "'Inter', sans-serif" },
            padding: 12,
            cornerRadius: 8
          }
        },
        animation: {
          animateScale: true,
          animateRotate: true
        }
      }
    });
  }

  updateChartData() {
    if (!this.chartInstance) return;
    this.chartInstance.data.datasets[0].data = [this.pendingTasks(), this.completedTasks()];
    this.chartInstance.update();
  }

  toggleDropdown() {
    this.showDropdown.set(!this.showDropdown());
  }

  closeDropdown() {
    this.showDropdown.set(false);
  }

  ngOnDestroy() {
    this.sub.unsubscribe();
    if (this.chartInstance) {
      this.chartInstance.destroy();
    }
  }
}