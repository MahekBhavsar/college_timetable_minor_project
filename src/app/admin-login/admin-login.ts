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

/* Inside src/app/admin-login/admin-login.ts */

async login() {
  if (!this.email || !this.password) {
    this.error.set('Please provide both email and password.');
    return;
  }

  this.loading.set(true);
  this.error.set('');
  this.success.set('');

  try {
    // Cast the result to 'any' to bypass strict property checking for the 'name' field
    const user = await this.firebaseService.adminLogin(this.email, this.password) as any;

    if (user) {
      localStorage.setItem('portal_user', JSON.stringify(user));

      if (user.role === 'admin') {
        // Accessing 'name' is now allowed because we cast to 'any'
        this.success.set(`Welcome Admin, ${user.name || 'Admin'}!`);
        setTimeout(() => this.router.navigate(['/admin/dashboard']), 1000);
      } else if (user.role === 'staff') {
        this.success.set(`Welcome Staff, ${user.name || 'Faculty'}!`);
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
