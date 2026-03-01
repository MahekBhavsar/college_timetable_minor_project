import { Component, signal, OnInit, AfterViewInit, ElementRef, ViewChild, OnDestroy, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FirebaseService } from '../services/firebaseservice';
import { Router, RouterLink } from '@angular/router';
import { AdminLayoutComponent } from '../admin-layout/admin-layout';
import Chart from 'chart.js/auto';
import { combineLatest, Subscription } from 'rxjs';
import { FirebaseCollections } from '../services/firebase-enums';

interface AcademicEvent {
  title: string;
  date: Date;
  sem: number;
}

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, AdminLayoutComponent, RouterLink],
  templateUrl: './admin-dashboard.html',
  styleUrl: './admin-dashboard.css'
})
export class AdminDashboard implements OnInit, AfterViewInit, OnDestroy {
  // Metrics
  totalStudents = signal<number>(0);
  totalStaff = signal<number>(0);
  totalSubjects = signal<number>(0);

  // New Data Sources
  upcomingEvents = signal<AcademicEvent[]>([]);
  recentActivity = signal<any[]>([]);

  @ViewChild('studentChart') studentChartRef!: ElementRef;

  private pieChartInstance: any;
  private subs = new Subscription();

  constructor(
    private fb: FirebaseService,
    private router: Router,
    @Inject(PLATFORM_ID) private platformId: Object
  ) { }

  ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      this.loadDashboardData();
    }
  }

  ngAfterViewInit() {
    // Charts will initialize once data loads
  }

  loadDashboardData() {
    this.subs.add(
      combineLatest([
        this.fb.getCollection<any>(FirebaseCollections.Application),
        this.fb.getCollection<any>(FirebaseCollections.Staff),
        this.fb.getCollection<any>(FirebaseCollections.Subjects),
        this.fb.getCollection<any>(FirebaseCollections.academic_planner as any),
        this.fb.getCollection<any>('assignments')
      ]).subscribe(([students, staff, subjects, planners, assignments]) => {

        // 1. Update Metrics
        this.totalStudents.set(students.filter(s => s.status === 'Application approved by staff').length || students.length);
        this.totalStaff.set(staff.length);
        this.totalSubjects.set(subjects.length);

        // 2. Process Academic Events
        this.processAcademicEvents(planners);

        // 3. Process Recent Activity
        this.processRecentActivity(assignments);

        // 4. Render Chart if in browser
        if (isPlatformBrowser(this.platformId)) {
          this.renderStudentPieChart(students);
        }
      })
    );
  }

  processAcademicEvents(planners: any[]) {
    let events: AcademicEvent[] = [];
    const now = new Date();

    // Set 'now' to start of day for accurate upcoming comparison
    now.setHours(0, 0, 0, 0);

    planners.forEach(p => {
      const sem = p.semester;

      const addEvent = (title: string, dateStr: string) => {
        if (!dateStr) return;
        const d = new Date(dateStr);
        if (!isNaN(d.getTime()) && d >= now) {
          events.push({ title, date: d, sem });
        }
      };

      addEvent('College Starts', p.collegeStart);
      addEvent('Class Test 1 Starts', p.classTest1Start);
      addEvent('Class Test 2 Starts', p.classTest2Start);
      addEvent('Internal Practical Starts', p.internalPracticalStart);
      addEvent('External Theory Starts', p.externalTheoryStart);
      addEvent('Internal Project Viva Starts', p.intProjectVivaStart);
    });

    events.sort((a, b) => a.date.getTime() - b.date.getTime());
    // Only keep top 10 upcoming events globally
    this.upcomingEvents.set(events.slice(0, 10));
  }

  processRecentActivity(assignments: any[]) {
    // Sort assignments by created at descending
    const sorted = [...assignments].sort((a, b) => {
      const dateA = new Date(a.createdAt || 0).getTime();
      const dateB = new Date(b.createdAt || 0).getTime();
      return dateB - dateA;
    });

    this.recentActivity.set(sorted.slice(0, 6)); // Top 6 most recent
  }

  renderStudentPieChart(students: any[]) {
    if (!this.studentChartRef) return;

    // Group students by semester (only approved)
    const approved = students.filter(s => s.status === 'Application approved by staff');
    const targetStudents = approved.length > 0 ? approved : students;

    const semCounts: { [key: string]: number } = {};
    targetStudents.forEach(s => {
      const sem = s.semester || 'Unknown';
      semCounts[`Sem ${sem}`] = (semCounts[`Sem ${sem}`] || 0) + 1;
    });

    const labels = Object.keys(semCounts).sort();
    const data = labels.map(l => semCounts[l]);

    if (this.pieChartInstance) this.pieChartInstance.destroy();

    this.pieChartInstance = new Chart(this.studentChartRef.nativeElement, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{
          data: data,
          backgroundColor: ['#0d6efd', '#198754', '#ffc107', '#dc3545', '#0dcaf0', '#6f42c1'],
          borderWidth: 2,
          hoverOffset: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'right' }
        },
        cutout: '70%'
      }
    });
  }

  ngOnDestroy() {
    this.subs.unsubscribe();
    if (this.pieChartInstance) this.pieChartInstance.destroy();
  }
}