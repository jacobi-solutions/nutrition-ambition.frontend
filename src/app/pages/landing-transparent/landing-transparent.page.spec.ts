import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LandingTransparentPage } from './landing-transparent.page';

describe('LandingTransparentPage', () => {
  let component: LandingTransparentPage;
  let fixture: ComponentFixture<LandingTransparentPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(LandingTransparentPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
