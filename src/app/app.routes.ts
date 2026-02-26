import { Routes } from '@angular/router';

// ------------------ ADMIN COMPONENTS ------------------
import { AdminLogin } from './admin-login/admin-login';
import { AdminDashboard } from './admin-dashboard/admin-dashboard';
import { ManageStaff } from './managed-staff/managed-staff';
import { Subject } from './subject/subject';
import { AcademicPlanner } from './academic-planner/academic-planner';
import { DivisionAllocationComponent } from './division-allocation/division-allocation';
import { AdminManageStudent } from './admin-manage-students/admin-manage-students';

// ------------------ STAFF COMPONENTS ------------------
import { StaffDashboard } from './staff/staff-dashboard/staff-dashboard';
import { StaffTimetable } from './staff/staff-timetable/staff-timetable';
import { StudentTimetable } from './staff/student-timetable/student-timetable';
import { TeacherPlanner } from './staff/planner/planner';
import { AddAssignment } from './staff/add-assignment/add-assignment';
import { AcademicPlannerView } from './staff/academic-planner/academic-planner';
import { StaffManageStudent } from './staff/staff-manage-students/staff-manage-students';
import { StaffViewSubmissions } from './staff/staff-view-submissions/staff-view-submissions';

// ------------------ STUDENT COMPONENTS ------------------
import { StudentLanding } from './student/student-landing/student-landing';
import { StudentReg } from './student/student-reg/student-reg';
import { StudentLogin } from './student/student-login/student-login';
import { StudentDashboard } from './student/student-dashboard/student-dashboard';
import { ViewTimetable } from './student/view-timetable/view-timetable';
import { StudentViewAssignments } from './student/student-view-assignments/student-view-assignments';
import { ViewAcademicPlanner } from './student/view-academic-planner/view-academic-planner';

// ------------------ COMMON COMPONENTS ------------------
import { TimetableComponent } from './timetable-component/timetable-component';

// ================= ROUTES =================
export const routes: Routes = [

  // 1. DEFAULT / LANDING PAGE
  { path: '', component: StudentLanding },

  // 2. AUTHENTICATION ROUTES
  { path: 'student-login', component: StudentLogin },
  { path: 'register', component: StudentReg },
  { path: 'admin/admin-login', component: AdminLogin },

  // 3. STUDENT ROUTES
  { path: 'student/dashboard', component: StudentDashboard },
  { path: 'student/view-assignments', component: StudentViewAssignments },
  { path: 'student/view-planner', component: ViewAcademicPlanner },
  { path: 'student/view-timetable', component: ViewTimetable },

  // 4. STAFF ROUTES
  { path: 'staff/staff-dashboard', component: StaffDashboard },
  { path: 'staff/timetable', component: StaffTimetable },
  { path: 'staff/student-timetable', component: StudentTimetable },
  { path: 'staff/planner', component: TeacherPlanner },
  { path: 'staff/assignment', component: AddAssignment },
  { path: 'staff/academic-planner', component: AcademicPlannerView },
  { path: 'staff/manage-students', component: StaffManageStudent },
  { path: 'staff/view-submissions', component: StaffViewSubmissions },

  // 5. ADMIN ROUTES
  { path: 'admin/dashboard', component: AdminDashboard },
  { path: 'admin/managed-staff', component: ManageStaff },
  { path: 'admin/subjects', component: Subject },
  { path: 'admin/academic-planner', component: AcademicPlanner },
  { path: 'admin/manage-students', component: AdminManageStudent },
  { path: 'admin/division-allocation', component: DivisionAllocationComponent },

  // 6. COMMON ROUTES
  { path: 'timetable', component: TimetableComponent },

  // 7. CATCH ALL - REDIRECT TO LANDING
  { path: '**', redirectTo: '' }
];