import { ComponentFixture, TestBed } from '@angular/core/testing';

import { StudentLogin } from './student-login';

describe('StudentLogin', () => {
  let component: StudentLogin;
  let fixture: ComponentFixture<StudentLogin>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StudentLogin]
    })
    .compileComponents();

    fixture = TestBed.createComponent(StudentLogin);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
