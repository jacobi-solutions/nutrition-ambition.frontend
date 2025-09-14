import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { NutritionAmbitionApiService, SubmitServingSelectionRequest, CancelServingSelectionRequest, ChatMessagesResponse, ErrorDto, EditFoodSelectionRequest, SubmitEditServingSelectionRequest, CancelEditSelectionRequest, SearchFoodPhraseRequest, SearchFoodPhraseResponse, HydrateFoodSelectionRequest, HydrateFoodSelectionResponse, GetInstantAlternativesRequest, GetInstantAlternativesResponse } from '../services/nutrition-ambition-api.service';
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
        const errorDto = new ErrorDto();
        errorDto.errorMessage = 'Cancel edit failed';
        return of(new ChatMessagesResponse({ isSuccess: false, errors: [errorDto] }));
      })
    );
  }

  searchFoodPhrase(request: SearchFoodPhraseRequest): Observable<SearchFoodPhraseResponse> {
    // Ensure localDateKey is set
    request.localDateKey = request.localDateKey || this.dateService.getSelectedDate();

    return this.apiService.searchFoodPhrase(request).pipe(
      catchError(err => {
        const errorDto = new ErrorDto();
        errorDto.errorMessage = 'Search failed';
        return of(new SearchFoodPhraseResponse({ isSuccess: false, errors: [errorDto] }));
      })
    );
  }

  updateFoodPhrase(request: SearchFoodPhraseRequest): Observable<SearchFoodPhraseResponse> {
    // Ensure localDateKey is set
    request.localDateKey = request.localDateKey || this.dateService.getSelectedDate();

    return this.apiService.updateFoodPhrase(request).pipe(
      catchError(err => {
        const errorDto = new ErrorDto();
        errorDto.errorMessage = 'Update failed';
        return of(new SearchFoodPhraseResponse({ isSuccess: false, errors: [errorDto] }));
      })
    );
  }

  hydrateFoodSelection(request: HydrateFoodSelectionRequest): Observable<HydrateFoodSelectionResponse> {
    return this.apiService.hydrateFoodSelection(request).pipe(
      catchError(err => {
        const errorDto = new ErrorDto();
        errorDto.errorMessage = 'Hydration failed';
        return of(new HydrateFoodSelectionResponse({ isSuccess: false, errors: [errorDto] }));
      })
    );
  }

  getInstantAlternatives(request: GetInstantAlternativesRequest): Observable<GetInstantAlternativesResponse> {
    // Ensure localDateKey is set
    request.localDateKey = request.localDateKey || this.dateService.getSelectedDate();

    return this.apiService.getInstantAlternatives(request).pipe(
      catchError(err => {
        const errorDto = new ErrorDto();
        errorDto.errorMessage = 'Failed to get instant alternatives';
        return of(new GetInstantAlternativesResponse({ isSuccess: false, errors: [errorDto] }));
      })
    );
  }
}