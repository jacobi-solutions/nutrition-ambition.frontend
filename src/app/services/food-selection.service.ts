import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { NutritionAmbitionApiService, SubmitServingSelectionRequest, SubmitServingSelectionResponse, ErrorDto } from '../services/nutrition-ambition-api.service';
import { DateService } from './date.service';

@Injectable({
  providedIn: 'root'
})
export class FoodSelectionService {
  constructor(
    private apiService: NutritionAmbitionApiService,
    private dateService: DateService
  ) {}

  submitServingSelection(request: SubmitServingSelectionRequest): Observable<SubmitServingSelectionResponse> {
    // Ensure loggedDateUtc is set
    request.loggedDateUtc = this.dateService.getSelectedDateUtc();

    return this.apiService.submitServingSelection(request).pipe(
      catchError(err => {
        console.error('Failed to submit selection', err);
        const errorDto = new ErrorDto();
        errorDto.errorMessage = 'Submission failed';
        return of(new SubmitServingSelectionResponse({ isSuccess: false, errors: [errorDto] }));
      })
    );
  }
}