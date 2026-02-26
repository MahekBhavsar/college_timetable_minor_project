import { Component, signal, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser, CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { FirebaseService } from '../../services/firebaseservice';
import { FirebaseCollections } from '../../services/firebase-enums';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './student-login.html'
})
export class StudentLogin {

  email = signal('');
  password = signal('');
  isLoading = signal(false);
  errorMessage = signal('');

  constructor(
    private firebaseService: FirebaseService,
    private router: Router,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  /* Inside login.component.ts */

async onLogin() {
  const emailInput = this.email().toLowerCase().trim();
  const passwordInput = this.password().trim();

  if (!emailInput || !passwordInput) {
    this.errorMessage.set("Please enter email and password.");
    return;
  }

  this.isLoading.set(true);
  this.errorMessage.set('');

  try {
    // 1️⃣ Call the single commonLogin method
    const user = await this.firebaseService.commonLogin(emailInput, passwordInput);

    if (user) {
      // 2️⃣ Save to localStorage (if in browser)
      if (isPlatformBrowser(this.platformId)) {
        localStorage.setItem('portal_user', JSON.stringify(user));
      }

      // 3️⃣ Route based on role
      switch (user.role) {
        case 'admin':
          this.router.navigate(['/admin/dashboard']);
          break;
        case 'staff':
          this.router.navigate(['/staff/staff-dashboard']);
          break;
        case 'student':
          this.router.navigate(['/student/dashboard']);
          break;
        default:
          this.errorMessage.set("Role not recognized.");
      }
    } else {
      this.errorMessage.set("Invalid email or password.");
    }

  } catch (error: any) {
    // Catch the "not approved" error or network errors
    this.errorMessage.set(error.message || "Login failed. Please try again.");
    console.error("Login Error:", error);
  } finally {
    this.isLoading.set(false);
  }
}
}