import { Routes } from '@angular/router';
import { AdminLogin } from './admin-login/admin-login';
import { AdminDashboard } from './admin-dashboard/admin-dashboard';
import { ManageStaff } from './managed-staff/managed-staff';
import { TimetableComponent } from './timetable-component/timetable-component';
import { Subject } from './subject/subject';
import { DivisionAllocationComponent } from './division-allocation/division-allocation';
import { AcademicPlanner } from './academic-planner/academic-planner';
import { StaffDashboard } from './staff/staff-dashboard/staff-dashboard';
import { StaffTimetable } from './staff/staff-timetable/staff-timetable';
import { StudentTimetable } from './staff/student-timetable/student-timetable';
import { TeacherPlanner } from './staff/planner/planner';

export const routes: Routes = [
  { path: '', redirectTo: 'admin-login', pathMatch: 'full' },
  { path: 'admin-login', component: AdminLogin },
  { path: 'admin/dashboard', component: AdminDashboard },
  {path:'admin/managed-staff',component:ManageStaff},
  {path:'timetable',component:TimetableComponent},
  {path:'admin/subjects',component:Subject},
   {path:'admin/division-allocation',component:DivisionAllocationComponent},
   {path:'admin/academic-planner',component:AcademicPlanner},
   {path:'staff/staff-dashboard',component:StaffDashboard},
   {path:'staff/timetable',component:StaffTimetable},
   {path:'staff/student-timetable',component:StudentTimetable},
   { path: 'staff/planner', component: TeacherPlanner }

];
