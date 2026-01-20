import { Component, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FirebaseService } from '../services/firebaseservice';
import { Router, RouterLink } from '@angular/router';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule,RouterLink],
  templateUrl: './admin-dashboard.html',
  styleUrl:'./admin-dashboard.css'
})
export class AdminDashboard implements OnInit {
  activeView = signal('overview'); // Controls which section is visible
  staffList = signal<any[]>([]);
  studentList = signal<any[]>([]);

  constructor(private fb: FirebaseService, private router: Router) {}

  ngOnInit() {
    //this.loadData();
  }

  setView(view: string) {
    this.activeView.set(view);
  }

  // loadData() {
  //   // Example of calling your existing FirebaseService methods
  //   this.fb.getCollection<any>(FirebaseCollections.Staff).subscribe(data => {
  //     this.staffList.set(data);
  //   });
  // }

  async logout() {
    await this.fb.logout();
    this.router.navigate(['/admin-login']);
  }

  openAddModal() {
    // Implement modal logic here
    console.log(`Adding new entry to ${this.activeView()}`);
  }
}