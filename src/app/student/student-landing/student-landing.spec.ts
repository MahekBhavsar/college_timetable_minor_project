import { ComponentFixture, TestBed } from '@angular/core/testing';

import { StudentLanding } from './student-landing';

describe('StudentLanding', () => {
  let component: StudentLanding;
  let fixture: ComponentFixture<StudentLanding>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StudentLanding]
    })
    .compileComponents();

    fixture = TestBed.createComponent(StudentLanding);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
