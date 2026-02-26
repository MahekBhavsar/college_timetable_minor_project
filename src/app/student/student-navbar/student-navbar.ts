import { Component, signal, afterNextRender, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { FirebaseService } from '../../services/firebaseservice';

interface Student {
  id: string | number;
  name: string;
  email: string;
}

interface Notification {
  message: string;
}

@Component({
  selector: 'app-student-navbar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './student-navbar.html'
})
export class StudentNavbar {
  private firebaseService = inject(FirebaseService);

  sidebarOpen = signal(true);
  dropdownOpen = signal(false);
  student = signal<Student | null>(null);
  notifications = signal<Notification[]>([]);

  constructor() {
    // 🛡️ Fixes the "localStorage is not defined" SSR Error
    afterNextRender(() => {
      this.initUser();
      this.initNotifications();
    });
  }

  private initUser() {
    const stored = localStorage.getItem('portal_user');
    if (stored) {
      this.student.set(JSON.parse(stored));
    } else {
      // Default fallback for UI testing
      this.student.set({ id: '1', name: 'Mahek Bhavsar', email: 'mahek@example.com' });
    }
  }

  private initNotifications() {
    this.notifications.set([
      { message: 'Assignment 2 due in 2 days' },
      { message: 'Internal exam on Friday' },
      { message: 'Workshop registration open' }
    ]);
  }

  toggleSidebar() {
    this.sidebarOpen.update(v => !v);
  }

  toggleDropdown() {
    this.dropdownOpen.update(v => !v);
  }
}