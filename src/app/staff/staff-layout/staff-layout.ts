import { Component, OnInit, signal, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';

@Component({
    selector: 'app-staff-layout',
    standalone: true,
    imports: [CommonModule, RouterLink, RouterLinkActive],
    templateUrl: './staff-layout.html',
    styleUrls: ['./staff-layout.css']
})
export class StaffLayoutComponent implements OnInit {
    isCollapsed = signal<boolean>(false);
    staffUser = signal<any>(null);

    constructor(public router: Router, @Inject(PLATFORM_ID) private platformId: Object) { }

    ngOnInit(): void {
        if (isPlatformBrowser(this.platformId)) {
            const data = localStorage.getItem('portal_user');
            if (data) {
                this.staffUser.set(JSON.parse(data));
            }
        }
    }

    toggleMenu() {
        this.isCollapsed.update(val => !val);
    }

    logout() {
        if (isPlatformBrowser(this.platformId)) {
            localStorage.removeItem('portal_user');
            this.router.navigate(['/admin-login']);
        }
    }
}
