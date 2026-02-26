import { ComponentFixture, TestBed } from '@angular/core/testing';

import { StudentNavbar } from './student-navbar';

describe('StudentNavbar', () => {
  let component: StudentNavbar;
  let fixture: ComponentFixture<StudentNavbar>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StudentNavbar]
    })
    .compileComponents();

    fixture = TestBed.createComponent(StudentNavbar);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
