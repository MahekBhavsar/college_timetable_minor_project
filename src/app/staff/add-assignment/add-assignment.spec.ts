import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AddAssignment } from './add-assignment';

describe('AddAssignment', () => {
  let component: AddAssignment;
  let fixture: ComponentFixture<AddAssignment>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AddAssignment]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AddAssignment);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
