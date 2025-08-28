import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { NutritionAmbitionApiService, SubmitServingSelectionRequest, CancelServingSelectionRequest, ChatMessagesResponse, ErrorDto, EditFoodSelectionRequest, SubmitEditServingSelectionRequest, CancelEditSelectionRequest } from '../services/nutrition-ambition-api.service';
import { DateService } from './date.service';

@Injectable({
  providedIn: 'root'
})
export class FoodSelectionService {
  constructor(
    private apiService: NutritionAmbitionApiService,
    private dateService: DateService
  ) {}

  submitServingSelection(request: SubmitServingSelectionRequest): Observable<ChatMessagesResponse> {
    // Ensure localDateKey is set
    request.localDateKey = this.dateService.getSelectedDate();

    return this.apiService.submitServingSelection(request).pipe(
      catchError(err => {
        console.error('Failed to submit selection', err);
        const errorDto = new ErrorDto();
        errorDto.errorMessage = 'Submission failed';
        return of(new ChatMessagesResponse({ isSuccess: false, errors: [errorDto] }));
      })
    );
  }

  cancelFoodLogging(request: CancelServingSelectionRequest): Observable<ChatMessagesResponse> {
    // Ensure localDateKey is set
    request.localDateKey = this.dateService.getSelectedDate();

    return this.apiService.cancelFoodLogging(request).pipe(
      catchError(err => {
        console.error('Failed to cancel food logging', err);
        const errorDto = new ErrorDto();
        errorDto.errorMessage = 'Cancel failed';
        return of(new ChatMessagesResponse({ isSuccess: false, errors: [errorDto] }));
      })
    );
  }

  startEditFoodSelection(req: EditFoodSelectionRequest): Observable<ChatMessagesResponse> {
    if (!req.localDateKey) req.localDateKey = this.dateService.getSelectedDate();
    return this.apiService.startEditSelection(req).pipe(
      catchError(err => {
        console.error('Failed to start edit selection', err);
        const error = new ErrorDto({ errorMessage: 'Start edit failed' });
        return of(new ChatMessagesResponse({ isSuccess: false, errors: [error] }));
      })
    );
  }

  submitEditServingSelection(request: SubmitEditServingSelectionRequest): Observable<ChatMessagesResponse> {
    // Ensure localDateKey is set
    request.localDateKey = this.dateService.getSelectedDate();

    return this.apiService.submitEditServingSelection(request).pipe(
      catchError(err => {
        console.error('Failed to submit edit selection', err);
        const errorDto = new ErrorDto();
        errorDto.errorMessage = 'Edit submission failed';
        return of(new ChatMessagesResponse({ isSuccess: false, errors: [errorDto] }));
      })
    );
  }

  cancelEditSelection(request: CancelEditSelectionRequest): Observable<ChatMessagesResponse> {
    // Ensure localDateKey is set
    request.localDateKey = this.dateService.getSelectedDate();

    return this.apiService.cancelEditSelection(request).pipe(
      catchError(err => {
        console.error('Failed to cancel edit selection', err);
        const errorDto = new ErrorDto();
        errorDto.errorMessage = 'Cancel edit failed';
        return of(new ChatMessagesResponse({ isSuccess: false, errors: [errorDto] }));
      })
    );
  }
}