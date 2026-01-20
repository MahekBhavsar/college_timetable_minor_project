import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ManagedStaff } from './managed-staff';

describe('ManagedStaff', () => {
  let component: ManagedStaff;
  let fixture: ComponentFixture<ManagedStaff>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ManagedStaff]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ManagedStaff);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
