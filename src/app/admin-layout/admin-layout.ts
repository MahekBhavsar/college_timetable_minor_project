import { Component, OnInit, signal, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { FirebaseService } from '../services/firebaseservice';

@Component({
    selector: 'app-admin-layout',
    standalone: true,
    imports: [CommonModule, RouterLink, RouterLinkActive],
    templateUrl: './admin-layout.html',
    styleUrls: ['./admin-layout.css']
})
export class AdminLayoutComponent implements OnInit {
    isCollapsed = signal<boolean>(false);
    adminUser = signal<any>({ name: 'Administrator', role: 'admin' });

    constructor(
        public router: Router,
        private fb: FirebaseService,
        @Inject(PLATFORM_ID) private platformId: Object
    ) { }

    ngOnInit(): void {
        if (isPlatformBrowser(this.platformId)) {
            try {
                const data = localStorage.getItem('portal_user');
                if (data) {
                    this.adminUser.set(JSON.parse(data));
                }
            } catch (e) {
                console.error("Error parsing admin user", e);
            }
        }
    }

    toggleMenu() {
        this.isCollapsed.update(val => !val);
    }

    async logout() {
        if (isPlatformBrowser(this.platformId)) {
            await this.fb.logout();
            localStorage.removeItem('portal_user');
            this.router.navigate(['/admin-login']);
        }
    }
}
