import { Component, Input, Output, EventEmitter, OnInit, signal, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './sidebar-component.html'
})
export class SidebarComponent implements OnInit {
  @Input() isCollapsed = false;
  @Output() toggleSidebar = new EventEmitter<void>();
  
  staffUser = signal<any>(null);

  constructor(public router: Router, @Inject(PLATFORM_ID) private platformId: Object) {}

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      const data = localStorage.getItem('portal_user');
      if (data) {
        this.staffUser.set(JSON.parse(data));
      }
    }
  }

  handleToggle() {
    this.toggleSidebar.emit();
  }

  logout() {
    if (isPlatformBrowser(this.platformId)) {
      localStorage.removeItem('portal_user');
      this.router.navigate(['/admin-login']);
    }
  }
}