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

  // New signals for file handling
  selectedFileBase64 = signal<string>('');
  fileName = signal<string>('');

  constructor(private firebaseService: FirebaseService, private router: Router) {}

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
  if (!this.name() || !this.email() || !this.password() || !this.selectedFileBase64()) {
    alert("Please fill all fields and upload a verification document.");
    return;
  }

  this.isSubmitting.set(true);
  try {
    const studentPayload = {
      name: this.name(),
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
    alert("Error: Registration failed.");
  } finally {
    this.isSubmitting.set(false);
  }
}
}