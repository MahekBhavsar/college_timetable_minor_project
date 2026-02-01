import { ComponentFixture, TestBed } from '@angular/core/testing';

import { StaffTimetable } from './staff-timetable';

describe('StaffTimetable', () => {
  let component: StaffTimetable;
  let fixture: ComponentFixture<StaffTimetable>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StaffTimetable]
    })
    .compileComponents();

    fixture = TestBed.createComponent(StaffTimetable);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
