import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { FirebaseService } from '../services/firebaseservice';

@Component({
  selector: 'app-admin-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-login.html'
})
export class AdminLogin {

  email = '';
  password = '';
  loading = signal(false);
  error = signal('');
  success = signal('');

  constructor(
    private firebaseService: FirebaseService,
    private router: Router
  ) {}

  async login() {
  this.loading.set(true);
  this.error.set('');

  try {
    const user = await this.firebaseService.adminLogin(this.email, this.password);

    if (user) {
      if (user.role === 'admin') {
        // Only Admin goes here
        this.success.set(`Welcome Admin, !`);
        setTimeout(() => this.router.navigate(['/admin/dashboard']), 1000);
      } else {
        // Staff goes here
        localStorage.setItem('staff_user', JSON.stringify(user));
        this.success.set(`Welcome Staff, !`);
        setTimeout(() => this.router.navigate(['/staff/staff-dashboard']), 1000);
      }
    } else {
      this.error.set('Incorrect email or password.');
    }
  } catch (err) {
    this.error.set('An error occurred during login.');
  } finally {
    this.loading.set(false);
  }
}
}
