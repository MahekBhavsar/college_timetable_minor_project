import { Component, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FirebaseService } from '../../services/firebaseservice';
import { StudentNavbar } from '../student-navbar/student-navbar';

@Component({
  selector: 'app-student-dashboard',
  standalone: true,
  imports: [CommonModule,StudentNavbar],
  templateUrl: './student-dashboard.html'
})
export class StudentDashboard implements OnInit {

  student = signal<any>(null);
  showDropdown = signal(false);

  // Demo notifications
  notifications = signal<any[]>([
    { message: 'Assignment 2 due in 2 days' },
    { message: 'Internal exam on Friday' },
    { message: 'Workshop registration open' }
  ]);

  // Demo notices
  notices = signal<any[]>([
    { title: 'Semester Fees Deadline', content: 'Pay before 30th Feb.' },
    { title: 'Sports Day', content: 'Annual sports event next week.' },
    { title: 'Library Update', content: 'New books added in Computer Dept.' }
  ]);

  constructor(private firebaseService: FirebaseService) {}

  ngOnInit() {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('portal_user');
      if (stored) {
        this.student.set(JSON.parse(stored));
      }
    }
  }

  toggleDropdown() {
    this.showDropdown.set(!this.showDropdown());
  }

  closeDropdown() {
    this.showDropdown.set(false);
  }
}