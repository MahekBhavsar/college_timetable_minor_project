import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AcademicPlanner } from './academic-planner';

describe('AcademicPlanner', () => {
  let component: AcademicPlanner;
  let fixture: ComponentFixture<AcademicPlanner>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AcademicPlanner]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AcademicPlanner);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
