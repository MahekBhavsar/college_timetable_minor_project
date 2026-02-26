import { ComponentFixture, TestBed } from '@angular/core/testing';

import { StudentViewAssignments } from './student-view-assignments';

describe('StudentViewAssignments', () => {
  let component: StudentViewAssignments;
  let fixture: ComponentFixture<StudentViewAssignments>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StudentViewAssignments]
    })
    .compileComponents();

    fixture = TestBed.createComponent(StudentViewAssignments);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
