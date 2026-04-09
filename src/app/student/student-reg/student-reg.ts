import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { FirebaseService } from '../../services/firebaseservice';
import { FirebaseCollections } from '../../services/firebase-enums';

@Component({
  selector: 'app-student-reg',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './student-reg.html'
})
export class StudentReg {
  name = signal('');
  email = signal('');
  password = signal('');
  semester = signal<number>(1);
  isSubmitting = signal(false);

  // Validation tracking
  fieldErrors = signal<{[key:string]:string}>({});

  // New signals for file handling
  selectedFileBase64 = signal<string>('');
  fileName = signal<string>('');

  constructor(private firebaseService: FirebaseService, private router: Router) {}

  // Helper: Basic email regex
  private isValidEmail(email: string): boolean {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email.trim());
  }

  // Convert selected file to Base64 string
// Add this signal to your class
fileError = signal<string | null>(null);

onFileSelected(event: any) {
  const file = event.target.files[0];
  this.fileError.set(null); // Clear previous errors

  if (file) {
    const extension = file.name.split('.').pop().toLowerCase();
    
    // Check for blocked .docx or .doc formats
    if (extension === 'docx' || extension === 'doc') {
      this.fileError.set("DOCX files cannot be viewed online. Please upload a PDF or Image instead.");
      this.fileName.set('');
      this.selectedFileBase64.set('');
      return;
    }

    // Standard processing for supported files
    this.fileName.set(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      this.selectedFileBase64.set(reader.result as string);
    };
    reader.readAsDataURL(file);
  }
}

async register() {
  // 1. Reset Errors
  this.fieldErrors.set({});
  let errors: any = {};
  let hasError = false;

  // 2. Client-side checks
  if (!this.name().trim() || this.name().trim().length < 3) {
    errors.name = "Full name is required (min 3 chars).";
    hasError = true;
  }

  if (!this.isValidEmail(this.email())) {
    errors.email = "Please enter a valid email address.";
    hasError = true;
  }

  if (this.password().length < 6) {
    errors.password = "Password must be at least 6 characters.";
    hasError = true;
  }

  if (!this.selectedFileBase64()) {
    errors.file = "Verification document is required.";
    hasError = true;
  }

  if (hasError) {
    this.fieldErrors.set(errors);
    return;
  }

  this.isSubmitting.set(true);
  try {
    // 3. One Login Validation (Unique Check)
    const exists = await this.firebaseService.checkEmailExists(this.email());
    if (exists) {
      this.fieldErrors.set({ email: "This email is already registered. Please login or use a different email." });
      this.isSubmitting.set(false);
      return;
    }

    const studentPayload = {
      name: this.name().trim(),
      email: this.email().toLowerCase().trim(),
      password: this.password(),
      semester: Number(this.semester()),
      division: 'TBA',
      elective: 'NONE'
    };

    // Save data and Base64 string in one call
    await this.firebaseService.registerWithDocument(studentPayload, this.selectedFileBase64());

    alert("Registration Successful! Staff will verify your document.");
    this.router.navigate(['/login']);
  } catch (err) {
    console.error("Registration failed:", err);
    alert("An unexpected error occurred. Please try again later.");
  } finally {
    this.isSubmitting.set(false);
  }
}
}