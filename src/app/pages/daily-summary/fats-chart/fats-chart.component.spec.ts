import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { FatsChartComponent } from './fats-chart.component';

describe('FatsChartComponent', () => {
  let component: FatsChartComponent;
  let fixture: ComponentFixture<FatsChartComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      imports: [FatsChartComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(FatsChartComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
