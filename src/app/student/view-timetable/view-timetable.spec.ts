import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ViewTimetable } from './view-timetable';

describe('ViewTimetable', () => {
  let component: ViewTimetable;
  let fixture: ComponentFixture<ViewTimetable>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ViewTimetable]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ViewTimetable);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
