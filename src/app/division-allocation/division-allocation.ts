import { Component, inject, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FirebaseService } from '../services/firebaseservice';
import { toSignal } from '@angular/core/rxjs-interop';
import { AdminLayoutComponent } from '../admin-layout/admin-layout';

@Component({
  selector: 'app-division-allocation',
  standalone: true,
  imports: [CommonModule, FormsModule, AdminLayoutComponent],
  templateUrl: './division-allocation.html',
  styleUrl: './division-allocation.css'
})
export class DivisionAllocationComponent {
  private fb = inject(FirebaseService);

  // --- NEW: These variables hold the text you type ---
  roomNameInput = '';
  roomTypeInput: 'Lecture Room' | 'Lab Room' = 'Lecture Room';

  divisions = ['A', 'B', 'C'];
  semesters = [1, 2, 3, 4, 5, 6];
  selectedDiv = signal('A');
  selectedSem = signal(1);

  rooms = toSignal(this.fb.getCollection<any>('rooms' as any), { initialValue: [] });
  allocations = toSignal(this.fb.getCollection<any>('division_allocations' as any), { initialValue: [] });

  form = { homeRoomId: '', selectedLabs: [] as string[] };

  constructor() {
    effect(() => {
      const existing = this.allocations().find(a => a.division === this.selectedDiv() && a.semester === this.selectedSem());
      if (existing) {
        this.form.homeRoomId = existing.homeRoomId;
        this.form.selectedLabs = [...(existing.selectedLabs || [])];
      } else {
        this.form.homeRoomId = '';
        this.form.selectedLabs = [];
      }
    });
  }

  // --- NEW: This adds the room to the list ---
  async addRoom() {
    if (!this.roomNameInput.trim()) return alert('Type a name first (e.g. CR-101)');
    await this.fb.addDocument('rooms' as any, {
      name: this.roomNameInput,
      type: this.roomTypeInput
    });
    this.roomNameInput = ''; // Clear the box logic
  }

  async deleteRoom(id: string) {
    if (confirm('Delete?')) await this.fb.deleteDocument('rooms' as any, id);
  }

  get lectureRooms() { return this.rooms().filter(r => r.type === 'Lecture Room'); }
  get labRooms() { return this.rooms().filter(r => r.type === 'Lab Room'); }

  toggleLab(roomId: string) {
    const idx = this.form.selectedLabs.indexOf(roomId);
    if (idx > -1) this.form.selectedLabs.splice(idx, 1);
    else this.form.selectedLabs.push(roomId);
  }

  async save() {
    if (!this.form.homeRoomId) return alert('Select a Home Room');
    const home = this.lectureRooms.find(r => r.id === this.form.homeRoomId);
    const data = {
      division: this.selectedDiv(),
      semester: this.selectedSem(),
      homeRoomId: this.form.homeRoomId,
      homeRoomName: home?.name,
      selectedLabs: this.form.selectedLabs,
      updatedAt: new Date()
    };
    const existing = this.allocations().find(a => a.division === this.selectedDiv() && a.semester === this.selectedSem());
    if (existing) await this.fb.updateDocument('division_allocations' as any, existing.id, data);
    else await this.fb.addDocument('division_allocations' as any, data);
    alert('Saved Successfully!');
  }
}