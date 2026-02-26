import { Component, signal, OnInit, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser, CommonModule } from '@angular/common';
import { FirebaseService } from '../../services/firebaseservice';
import { FirebaseCollections } from '../../services/firebase-enums';
import { firstValueFrom } from 'rxjs';
import { StudentNavbar } from '../student-navbar/student-navbar';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
@Component({
  selector: 'app-student-dashboard',
  standalone: true,
  imports: [CommonModule,StudentNavbar],
  templateUrl: './view-timetable.html'
})
export class ViewTimetable implements OnInit {
async exportToPDF() {
    const data = document.getElementById('timetable-content');
    if (!data) return;

    // Optional: Show loading state
    try {
      const canvas = await html2canvas(data, {
        scale: 2, // Higher quality
        useCORS: true,
        logging: false
      });

      const imgWidth = 210; // A4 Width in mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      const contentDataURL = canvas.toDataURL('image/png');
      
      const pdf = new jsPDF('p', 'mm', 'a4');
      const position = 10; // Margin top

      pdf.addImage(contentDataURL, 'PNG', 0, position, imgWidth, imgHeight);
      pdf.save(`Timetable_${this.student()?.name || 'Student'}.pdf`);
    } catch (error) {
      console.error("PDF Export failed", error);
    }
  }
  student = signal<any>(null);
  assignments = signal<any[]>([]);
  planner = signal<any[]>([]);
  isLoading = signal<boolean>(true);

  timetableGrid = signal<any>({});
  timeSlots = signal<string[]>([]);
  days = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

  constructor(
    private firebaseService: FirebaseService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  async ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {

      const stored = localStorage.getItem('student_user');
      if (!stored) {
        this.isLoading.set(false);
        return;
      }

      try {
        const user = JSON.parse(stored);
        this.student.set(user);
        await this.loadData(user);
      }
      catch (error) {
        console.error("Dashboard failed:", error);
      }
      finally {
        this.isLoading.set(false);
      }
    }
  }

  // 🔥 convert 08:00 AM → minutes
  timeToMinutes(t: string) {
    const [time, modifier] = t.split(' ');
    let [hours, minutes] = time.split(':').map(Number);

    if (modifier === 'PM' && hours !== 12) hours += 12;
    if (modifier === 'AM' && hours === 12) hours = 0;

    return hours * 60 + minutes;
  }

  async loadData(user: any) {

    const semValue = Number(user.semester);
    const divValue = String(user.division);

    try {

      const [tt, asg, plan] = await Promise.all([
        firstValueFrom(
          this.firebaseService.getMultipleFilteredCollection(
            FirebaseCollections.Timetable,
            [{ field: 'sem', value: semValue }, { field: 'div', value: divValue }]
          )
        ),
        firstValueFrom(
          this.firebaseService.getMultipleFilteredCollection(
            FirebaseCollections.assignments,
            [{ field: 'sem', value: semValue }, { field: 'div', value: divValue }]
          )
        ),
        firstValueFrom(
          this.firebaseService.getFilteredCollection(
            FirebaseCollections.academic_planner,
            'sem',
            semValue
          )
        )
      ]);

      // ======================
      // BUILD GRID
      // ======================
      const grid: any = {};
      const times = new Set<string>();

      (tt as any[]).forEach((lec: any) => {

        const day = lec.day;
        const time = lec.time;

        if (!day || !time) return;

        times.add(time);

        if (!grid[time]) grid[time] = {};

        grid[time][day] = {
          subject: lec.subject,
          sem: lec.sem,
          div: lec.div,
          staffName: lec.staffName,
          roomName: lec.roomName,
          type: lec.type
        };
      });

      // ======================
      // SORT TIMES PROPERLY
      // ======================
      const sortedTimes = Array.from(times).sort((a: any, b: any) => {
        const startA = a.split(' - ')[0];
        const startB = b.split(' - ')[0];
        return this.timeToMinutes(startA) - this.timeToMinutes(startB);
      });

      this.timeSlots.set(sortedTimes);
      this.timetableGrid.set(grid);
      this.assignments.set(asg as any[]);
      this.planner.set(plan as any[]);

    } catch (error) {
      console.error("Firebase Sync Error:", error);
    }
  }
}
