import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FirebaseService } from '../../services/firebaseservice';
import { FirebaseCollections } from '../../services/firebase-enums';

@Component({
  selector: 'app-student-landing',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './student-landing.html'
})
export class StudentLanding implements OnInit {
  recentUpdates = signal<any[]>([]);
  academicNotice = signal<any>(null);
  isLoading = signal(true);

  constructor(private firebaseService: FirebaseService) {}

  ngOnInit() {
    this.loadGlobalData();
  }

  loadGlobalData() {
    // Fetch latest global activities/assignments
    this.firebaseService.getCollection<any>(FirebaseCollections.assignments as any)
      .subscribe(data => {
        const sorted = data.sort((a, b) => {
           const dateA = a.createdAt?.seconds || 0;
           const dateB = b.createdAt?.seconds || 0;
           return dateB - dateA;
        }).slice(0, 6);
        this.recentUpdates.set(sorted);
        this.isLoading.set(false);
      });

    // Fetch Academic Planner (Semester 1 as global context)
    this.firebaseService.getFilteredCollection<any>(FirebaseCollections.academic_planner as any, 'semester', 1)
      .subscribe(data => {
        if (data.length > 0) this.academicNotice.set(data[0]);
      });
  }
}