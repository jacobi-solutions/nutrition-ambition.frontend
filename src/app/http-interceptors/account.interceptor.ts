// src/app/services/account.interceptor.ts
import { inject } from '@angular/core';
import { HttpInterceptorFn, HttpRequest, HttpHandlerFn, HttpEvent, HttpResponse } from '@angular/common/http';
import { Observable, tap, switchMap, of, from } from 'rxjs';
import { AccountsService } from '../services/accounts.service';
import { environment } from 'src/environments/environment';

export const AccountInterceptor: HttpInterceptorFn = (req: HttpRequest<any>, next: HttpHandlerFn): Observable<HttpEvent<any>> => {
  const accountsService = inject(AccountsService);

  if (!req.url.startsWith(environment.backendApiUrl)) {
    return next(req);
  }

  const accountId = accountsService.getAccountId();
  console.log(`[AccountInterceptor] Processing request to ${req.url}`);
  console.log(`[AccountInterceptor] Current accountId: ${accountId || 'none'}`);

  // Clone the request with the accountId
  let clonedRequest: HttpRequest<any>;
  
  if (accountId) {
    // Initialize newBody with the existing body
    let newBody = req.body;
    
    // For string bodies (JSON strings), parse, add accountId, and stringify
    if (typeof req.body === 'string') {
      try {
        // Parse the JSON string if possible 
        const bodyObj = JSON.parse(req.body);
        
        // Add accountId to the parsed object
        newBody = JSON.stringify({
          ...bodyObj,
          accountId
        });
        console.log(`[AccountInterceptor] Added accountId to string request body`);
      } catch (e) {
        // If parsing fails, use the original body
        console.error('[AccountInterceptor] Failed to parse request body', e);
      }
    } 
    // For regular objects, use spread operator
    else if (typeof req.body === 'object' && req.body !== null && !Array.isArray(req.body)) {
      newBody = { ...req.body, accountId };
      console.log(`[AccountInterceptor] Added accountId to object request body`);
    }
    
    clonedRequest = req.clone({
      body: newBody
    });
  } else {
    console.log(`[AccountInterceptor] No accountId available, request will create a new anonymous account`);
    clonedRequest = req.clone();
  }

  // Helper function to read Blob as JSON
  const readBlobAsJson = (blob: Blob): Promise<any> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const jsonData = JSON.parse(reader.result as string);
          resolve(jsonData);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsText(blob);
    });
  };

  // Process the response to save accountId from responses
  return next(clonedRequest).pipe(
    switchMap(event => {
      // Only process HttpResponse objects (not events like HttpProgressEvent)
      if (event instanceof HttpResponse) {
        console.log(`[AccountInterceptor] Response from ${event.url}:`, event.status);
        const responseBody = event.body;
        
        // Check if the body is a Blob (which it usually is due to responseType: 'blob' in the service)
        if (responseBody instanceof Blob) {
          console.log('[AccountInterceptor] Response body is a Blob, reading as JSON');
          
          // Return a new observable that will emit the modified response
          return from(readBlobAsJson(responseBody)).pipe(
            switchMap(jsonData => {
              console.log('[AccountInterceptor] Parsed JSON data');
              
              // Extract accountId from JSON if it exists
              if (jsonData && typeof jsonData === 'object') {
                // Use type assertion to access accountId
                const responseAccountId = (jsonData as { accountId?: string }).accountId;
                
                if (responseAccountId && typeof responseAccountId === 'string') {
                  console.log('[AccountInterceptor] Found accountId in response:', responseAccountId);
                  
                  // Check if this is different from our current accountId
                  const currentAccountId = accountsService.getAccountId();
                  if (currentAccountId !== responseAccountId) {
                    console.log('[AccountInterceptor] Setting new accountId:', responseAccountId);
                    // Save the accountId
                    accountsService.setAccountId(responseAccountId);
                  } else {
                    console.log('[AccountInterceptor] AccountId unchanged');
                  }
                }
              }
              
              // Return the original event to keep the stream going
              return of(event);
            })
          );
        } else if (responseBody && typeof responseBody === 'object') {
          // If it's already an object, check for accountId
          // Use type assertion to access accountId
          const responseAccountId = (responseBody as { accountId?: string }).accountId;
          
          if (responseAccountId && typeof responseAccountId === 'string') {
            console.log('[AccountInterceptor] Found accountId in object response:', responseAccountId);
            
            // Check if this is different from our current accountId
            const currentAccountId = accountsService.getAccountId();
            if (currentAccountId !== responseAccountId) {
              console.log('[AccountInterceptor] Setting new accountId:', responseAccountId);
              accountsService.setAccountId(responseAccountId);
            } else {
              console.log('[AccountInterceptor] AccountId unchanged');
            }
          }
        }
      }
      
      // Return the original event if no special processing was needed
      return of(event);
    })
  );
};
