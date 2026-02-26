import { Component, signal, Inject, PLATFORM_ID, OnInit } from '@angular/core';
import { isPlatformBrowser, CommonModule } from '@angular/common';
import { FirebaseService } from '../../services/firebaseservice';
import { FirebaseCollections } from '../../services/firebase-enums';
import { firstValueFrom } from 'rxjs';
import { StudentNavbar } from '../student-navbar/student-navbar';

@Component({
  selector: 'app-student-view-assignments',
  standalone: true,
  imports: [CommonModule,StudentNavbar],
  templateUrl: './student-view-assignments.html'
})
export class StudentViewAssignments implements OnInit {

  student = signal<any>(null);
  assignments = signal<any[]>([]);
  loading = signal(true);

  // upload system
  selectedFiles = signal<{[key:string]:File}>({});
  uploadingId = signal<string | null>(null);

  // store submitted assignments
  submittedMap = signal<{ [key: string]: any }>({});

  constructor(
    private firebaseService: FirebaseService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  async ngOnInit() {
    if (!isPlatformBrowser(this.platformId)) return;

    const stored = localStorage.getItem('portal_user');
    if (!stored) return;

    const user = JSON.parse(stored);
    this.student.set(user);

    await this.loadAssignments();
  }

  async loadAssignments() {

    const semester = this.student().semester;
    const division = this.student().division;
    const studentId = this.student().id;

    // 1️⃣ Load assignments
    const data = await firstValueFrom(
      this.firebaseService.getFilteredCollection<any>(
        FirebaseCollections.assignments,
        'semester',
        Number(semester)
      )
    );

    const filtered = data.filter(a =>
      a.divisions?.includes(division)
    );

    filtered.sort((a,b)=> b.createdAt.localeCompare(a.createdAt));
    this.assignments.set(filtered);

    // 2️⃣ Load student submissions
    const submissions = await firstValueFrom(
      this.firebaseService.getFilteredCollection<any>(
        FirebaseCollections.assignment_submissions,
        'studentId',
        studentId
      )
    );

    const map: any = {};
    submissions.forEach(s => {
      map[s.assignmentId] = s;
    });

    this.submittedMap.set(map);

    this.loading.set(false);
  }

  // open file
  viewFile(base64: string, fileName: string) {
    const link = document.createElement('a');
    link.href = base64;
    link.download = fileName || 'file';
    link.target = '_blank';
    link.click();
  }

  // select response
  selectResponseFile(event: any, assignmentId: string) {
    const file = event.target.files[0];
    if (!file) return;

    const map = this.selectedFiles();
    map[assignmentId] = file;
    this.selectedFiles.set({...map});
  }

  // submit response
  async submitResponse(a: any) {

    // 🔒 Prevent duplicate submission
    if (this.submittedMap()[a.id]) {
      alert("You have already submitted this assignment.");
      return;
    }

    const file = this.selectedFiles()[a.id];
    if (!file) {
      alert("Please choose file first");
      return;
    }

    this.uploadingId.set(a.id);

    const base64 = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(file);
    });

    const payload = {
      assignmentId: a.id,
      studentId: this.student().id,
      studentName: this.student().name,
      subject: a.subject,
      semester: this.student().semester,
      division: this.student().division,
      fileData: base64,
      fileName: file.name,
      submittedAt: new Date().toISOString(),
      status: 'Submitted'
    };

    await this.firebaseService.addDocument(
      FirebaseCollections.assignment_submissions,
      payload
    );

    // update UI instantly
    const currentMap = this.submittedMap();
    currentMap[a.id] = payload;
    this.submittedMap.set({...currentMap});

    alert("Assignment submitted successfully 🎉");

    this.uploadingId.set(null);
  }
}