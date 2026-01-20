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
    this.success.set('');

    try {
      await this.firebaseService.adminLogin(this.email, this.password);
      this.success.set('Login successful! Redirecting...');
      // Wait 1.5 seconds so user sees the message, then navigate
      setTimeout(() => {
        this.router.navigate(['/admin/dashboard']);
      }, 1500);
    } catch (err:any) {
      this.error.set('Invalid Admin Credentials');
    }

    this.loading.set(false);
  }
}
