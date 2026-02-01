import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DivisionAllocation } from './division-allocation';

describe('DivisionAllocation', () => {
  let component: DivisionAllocation;
  let fixture: ComponentFixture<DivisionAllocation>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DivisionAllocation]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DivisionAllocation);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
