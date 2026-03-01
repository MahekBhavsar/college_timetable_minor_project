import { Component, signal, Inject, PLATFORM_ID, OnInit, ViewChild, ElementRef } from '@angular/core';
import { isPlatformBrowser, CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FirebaseService } from '../../services/firebaseservice';
import { FirebaseCollections } from '../../services/firebase-enums';
import { firstValueFrom } from 'rxjs';
import { StaffLayoutComponent } from '../staff-layout/staff-layout';

@Component({
  selector: 'app-add-assignment',
  standalone: true,
  imports: [CommonModule, FormsModule, StaffLayoutComponent],
  templateUrl: './add-assignment.html',
  styleUrls: ['./add-assignment.css']
})
export class AddAssignment implements OnInit {

  @ViewChild('attachment') attachmentInput!: ElementRef;

  staffUser = signal<any>(null);
  assignedSubjects = signal<string[]>([]);
  allAssignments = signal<any[]>([]);

  availableDivisions = ['A', 'B', 'C'];
  selectedDivisions = signal<string[]>([]);
  selectAll = signal(false);

  editingId = signal<string | null>(null);
  title = signal('');
  description = signal('');
  subject = signal('');
  type = signal<'HOME' | 'CLASS'>('HOME');
  selectedDate = signal('');
  isSubmitting = signal(false);

  plannerData: any = null;

  file: File | null = null;
  currentBase64: string = '';

  constructor(
    private firebaseService: FirebaseService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) { }

  async ngOnInit() {
    if (!isPlatformBrowser(this.platformId)) return;

    const stored = localStorage.getItem('portal_user');
    if (!stored) return;

    const user = JSON.parse(stored);
    this.staffUser.set(user);

    await this.loadSubjects(user.name);
    await this.loadPlanner(user.semester);
    this.fetchAssignments();
  }

  fetchAssignments() {
    this.firebaseService.getFilteredCollection<any>(
      FirebaseCollections.assignments as any,
      'staffName',
      this.staffUser().name
    ).subscribe(data => {
      this.allAssignments.set(
        data.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      );
    });
  }

  async loadSubjects(name: string) {
    const data = await firstValueFrom(
      this.firebaseService.getFilteredCollection<any>(
        FirebaseCollections.Timetable,
        'staffName',
        name
      )
    );
    this.assignedSubjects.set([...new Set(data.map((x: any) => x.subject))]);
  }

  async loadPlanner(semester: number) {
    const planners = await firstValueFrom(
      this.firebaseService.getFilteredCollection<any>(
        FirebaseCollections.academic_planner,
        'semester',
        Number(semester)
      )
    );
    if (planners.length > 0) this.plannerData = planners[0];
  }

  toggleDivision(div: string, checked: boolean) {
    const current = this.selectedDivisions();
    if (checked)
      this.selectedDivisions.set([...current, div]);
    else
      this.selectedDivisions.set(current.filter(d => d !== div));
  }

  toggleSelectAll(checked: boolean) {
    this.selectAll.set(checked);
    this.selectedDivisions.set(
      checked ? [...this.availableDivisions] : []
    );
  }

  // ✅ FIXED FILE HANDLING
  onFile(event: any) {

    const selected = event.target.files[0];
    if (!selected) return;

    // 🔴 FIRESTORE LIMIT PROTECTION
    if (selected.size > 700000) {
      alert("File too large! Keep file under 700KB");
      event.target.value = '';
      return;
    }

    this.file = selected;

    const reader = new FileReader();

    reader.onload = () => {
      this.currentBase64 = reader.result as string;
      console.log("File converted successfully");
    };

    reader.readAsDataURL(selected);
  }

  validateDate(): boolean {
    if (!this.plannerData) return false;

    const chosen = this.selectedDate();
    const start = this.type() === 'HOME'
      ? this.plannerData.homeAssignmentStart
      : this.plannerData.classAssignmentStart;

    const end = this.type() === 'HOME'
      ? this.plannerData.homeAssignmentEnd
      : this.plannerData.classAssignmentEnd;

    return !!(chosen && start && end && chosen >= start && chosen <= end);
  }

  async submit() {

    if (!this.subject() || !this.title() || !this.selectedDate() || this.selectedDivisions().length === 0) {
      alert("Fill all fields & select divisions");
      return;
    }

    if (!this.validateDate()) {
      alert("Date outside academic planner");
      return;
    }

    // 🔴 HOME MUST HAVE FILE
    if (this.type() === 'HOME' && !this.currentBase64) {
      alert("Please upload assignment file");
      return;
    }

    this.isSubmitting.set(true);

    const payload = {
      staffName: this.staffUser().name,
      subject: this.subject(),
      title: this.title(),
      description: this.description(),
      type: this.type(),
      date: this.selectedDate(),
      divisions: this.selectedDivisions(),
      semester: this.staffUser().semester,
      fileData: this.type() === 'HOME' ? this.currentBase64 : '',
      fileName: this.type() === 'HOME' ? (this.file?.name || '') : '',
      createdAt: new Date().toISOString()
    };

    if (this.editingId()) {
      await this.firebaseService.updateDocument(
        FirebaseCollections.assignments as any,
        this.editingId()!,
        payload
      );
    } else {
      await this.firebaseService.addDocument(
        FirebaseCollections.assignments as any,
        payload
      );
    }

    alert("Assignment Published Successfully 🎉");

    this.resetForm();
    this.isSubmitting.set(false);
  }

  resetForm() {
    this.editingId.set(null);
    this.title.set('');
    this.description.set('');
    this.selectedDate.set('');
    this.selectedDivisions.set([]);
    this.selectAll.set(false);
    this.file = null;
    this.currentBase64 = '';
    if (this.attachmentInput)
      this.attachmentInput.nativeElement.value = '';
  }

  viewAssignment(data: string) {
    const win = window.open();
    if (win) {
      win.document.write(`
        <iframe src="${data}" style="width:100%;height:100%;border:none"></iframe>
      `);
    }
  }

  editAssignment(item: any) {
    this.editingId.set(item.id);
    this.subject.set(item.subject);
    this.title.set(item.title);
    this.description.set(item.description);
    this.type.set(item.type);
    this.selectedDate.set(item.date);
    this.selectedDivisions.set(item.divisions || []);
    this.selectAll.set(
      this.selectedDivisions().length === this.availableDivisions.length
    );
    this.currentBase64 = item.fileData || '';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async deleteAssignment(id: string) {
    if (!confirm("Delete this assignment permanently?")) return;

    await this.firebaseService.deleteDocument(
      FirebaseCollections.assignments as any,
      id
    );
  }
}
