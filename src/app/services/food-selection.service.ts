import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { NutritionAmbitionApiService, SubmitServingSelectionRequest, SubmitServingSelectionResponse, CancelServingSelectionRequest, BotMessageResponse, ErrorDto, EditFoodSelectionRequest, SubmitEditServingSelectionRequest } from '../services/nutrition-ambition-api.service';
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

  cancelFoodLogging(request: CancelServingSelectionRequest): Observable<BotMessageResponse> {
    // Ensure loggedDateUtc is set
    request.loggedDateUtc = this.dateService.getSelectedDateUtc();

    return this.apiService.cancelFoodLogging(request).pipe(
      catchError(err => {
        console.error('Failed to cancel food logging', err);
        const errorDto = new ErrorDto();
        errorDto.errorMessage = 'Cancel failed';
        return of(new BotMessageResponse({ isSuccess: false, errors: [errorDto] }));
      })
    );
  }

  startEditFoodSelection(req: EditFoodSelectionRequest): Observable<BotMessageResponse> {
    if (!req.loggedDateUtc) req.loggedDateUtc = this.dateService.getSelectedDateUtc();
    return this.apiService.startEditSelection(req).pipe(
      catchError(err => {
        console.error('Failed to start edit selection', err);
        const error = new ErrorDto({ errorMessage: 'Start edit failed' });
        return of(new BotMessageResponse({ isSuccess: false, errors: [error] }));
      })
    );
  }

  submitEditServingSelection(request: SubmitEditServingSelectionRequest): Observable<SubmitServingSelectionResponse> {
    // Ensure loggedDateUtc is set
    request.loggedDateUtc = this.dateService.getSelectedDateUtc();

    return this.apiService.submitEditServingSelection(request).pipe(
      catchError(err => {
        console.error('Failed to submit edit selection', err);
        const errorDto = new ErrorDto();
        errorDto.errorMessage = 'Edit submission failed';
        return of(new SubmitServingSelectionResponse({ isSuccess: false, errors: [errorDto] }));
      })
    );
  }
}