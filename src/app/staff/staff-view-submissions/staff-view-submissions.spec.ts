import { ComponentFixture, TestBed } from '@angular/core/testing';

import { StaffViewSubmissions } from './staff-view-submissions';

describe('StaffViewSubmissions', () => {
  let component: StaffViewSubmissions;
  let fixture: ComponentFixture<StaffViewSubmissions>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StaffViewSubmissions]
    })
    .compileComponents();

    fixture = TestBed.createComponent(StaffViewSubmissions);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
