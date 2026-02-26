import { ComponentFixture, TestBed } from '@angular/core/testing';

import { StudentReg } from './student-reg';

describe('StudentReg', () => {
  let component: StudentReg;
  let fixture: ComponentFixture<StudentReg>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StudentReg]
    })
    .compileComponents();

    fixture = TestBed.createComponent(StudentReg);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
