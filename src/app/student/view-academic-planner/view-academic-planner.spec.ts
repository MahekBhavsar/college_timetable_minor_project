import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ViewAcademicPlanner } from './view-academic-planner';

describe('ViewAcademicPlanner', () => {
  let component: ViewAcademicPlanner;
  let fixture: ComponentFixture<ViewAcademicPlanner>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ViewAcademicPlanner]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ViewAcademicPlanner);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
