import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ManagedTimetableStaff } from './managed-timetable-staff';

describe('ManagedTimetableStaff', () => {
  let component: ManagedTimetableStaff;
  let fixture: ComponentFixture<ManagedTimetableStaff>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ManagedTimetableStaff]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ManagedTimetableStaff);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
