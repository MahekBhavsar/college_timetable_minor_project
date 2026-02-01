import { ComponentFixture, TestBed } from '@angular/core/testing';

import { StudentTimetable } from './student-timetable';

describe('StudentTimetable', () => {
  let component: StudentTimetable;
  let fixture: ComponentFixture<StudentTimetable>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StudentTimetable]
    })
    .compileComponents();

    fixture = TestBed.createComponent(StudentTimetable);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
