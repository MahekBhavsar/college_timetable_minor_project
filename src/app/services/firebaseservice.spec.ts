import { TestBed } from '@angular/core/testing';

import { Firebaseservice } from './firebaseservice';

describe('Firebaseservice', () => {
  let service: Firebaseservice;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Firebaseservice);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
