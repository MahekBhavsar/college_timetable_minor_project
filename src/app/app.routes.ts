import { Routes } from '@angular/router';
import { AdminLogin } from './admin-login/admin-login';
import { AdminDashboard } from './admin-dashboard/admin-dashboard';
import { ManageStaff } from './managed-staff/managed-staff';
import { TimetableComponent } from './timetable-component/timetable-component';

export const routes: Routes = [
  { path: '', redirectTo: 'admin-login', pathMatch: 'full' },
  { path: 'admin-login', component: AdminLogin },
  { path: 'admin/dashboard', component: AdminDashboard },
  {path:'admin/managed-staff',component:ManageStaff},
  {path:'timetable',component:TimetableComponent}
];
