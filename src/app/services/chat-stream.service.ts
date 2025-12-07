import { Injectable } from '@angular/core';
import { environment } from 'src/environments/environment';
import { ChatMessagesResponse, RunChatRequest, DirectLogMealRequest, SearchFoodPhraseResponse, SetupGoalsRequest, LearnMoreAboutRequest, BarcodeSearchRequest, TriggerConversationContinuationRequest } from './nutrition-ambition-api.service';
import { AuthService } from './auth.service';
import { DateService } from './date.service';
import { RestrictedAccessService } from './restricted-access.service';
import { AccountsService } from './accounts.service';

@Injectable({ providedIn: 'root' })
export class ChatStreamService {
  private baseUrl = `${environment.backendApiUrl}/api/conversation`;

  // Streaming timeout configuration
  private readonly STREAM_TIMEOUT_MS = 60000;
  private readonly TIMEOUT_CHECK_INTERVAL_MS = 5000;

  constructor(
    private authService: AuthService,
    private dateService: DateService,
    private restrictedAccessService: RestrictedAccessService,
    private accountsService: AccountsService
  ) {}

  /**
   * Generic SSE stream handler to eliminate code duplication
   * @param url - The API endpoint URL
   * @param requestBody - The request body to send
   * @param responseClass - The response class with fromJS method for deserialization
   * @param onChunk - Callback for each parsed chunk
   * @param onComplete - Callback when stream completes
   * @param onError - Callback for errors
   * @returns Stream handle for cleanup
   */
  private async handleSSEStream<T extends { isSuccess?: boolean; errors?: any[]; isRestricted?: boolean; restrictedAccessPhase?: string; restrictedAccessRedirectUrl?: string }>(
    url: string,
    requestBody: any,
    responseClass: { fromJS: (data: any) => T },
    onChunk: (data: T) => void,
    onComplete: () => void,
    onError: (error: any) => void
  ): Promise<any | null> {
    try {
      // Get auth token
      const token = await this.authService.getIdToken();
      if (!token) {
        onError(new Error('No auth token available'));
        return null;
      }

      // Get timezone and client version for headers
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const clientVersion = '1.0.0';

      // Send POST request with streaming response
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'X-Timezone': timezone,
          'X-Client-Version': clientVersion
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[SSEStream] HTTP error response:', errorText);

        // Check for 403 restricted access response
        if (response.status === 403) {
          try {
            const errorData = JSON.parse(errorText);
            if (errorData.isRestricted) {
              this.restrictedAccessService.handleRestrictedAccess(
                errorData.phase || '',
                errorData.redirectUrl || ''
              );
              onComplete(); // Complete gracefully instead of error
              return null;
            }
          } catch {
            // Not a JSON response, continue with normal error handling
          }
        }

        onError(new Error(`HTTP error! status: ${response.status}`));
        return null;
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        onError(new Error('No response body'));
        return null;
      }

      let buffer = '';

      // Add timeout tracking
      let lastChunkTime = Date.now();

      const timeoutCheck = setInterval(() => {
        if (Date.now() - lastChunkTime > this.STREAM_TIMEOUT_MS) {
          console.error('[SSEStream] Stream timeout - no data for 60 seconds');
          clearInterval(timeoutCheck);
          reader.cancel();
          onError(new Error('Stream timeout - no data received for 60 seconds'));
        }
      }, this.TIMEOUT_CHECK_INTERVAL_MS);

      // Process the stream
      const processStream = async () => {
        try {
          while (true) {
            const { done, value } = await reader.read();

            if (done) {
              clearInterval(timeoutCheck);
              onComplete();
              break;
            }

            // Update activity timestamp
            lastChunkTime = Date.now();

            // Decode the chunk and add to buffer
            const chunk = decoder.decode(value, { stream: true });
            buffer += chunk;

            // Process complete lines
            const lines = buffer.split('\n');
            buffer = lines.pop() || ''; // Keep incomplete line in buffer

            for (const line of lines) {
              if (line.trim() === '') {
                continue; // Skip empty lines
              }

              if (line.startsWith('data: ')) {
                try {
                  const jsonData = line.substring(6);
                  const rawData = JSON.parse(jsonData);

                  // Use the generated fromJS method to properly deserialize
                  const parsed = responseClass.fromJS(rawData);

                  // Check for restricted access response from backend
                  if (parsed.isRestricted) {
                    clearInterval(timeoutCheck);
                    reader.cancel();
                    this.accountsService.setSkipUpgradeContinuation();
                    this.restrictedAccessService.handleRestrictedAccess(
                      parsed.restrictedAccessPhase || '',
                      parsed.restrictedAccessRedirectUrl || ''
                    );
                    onComplete(); // Complete gracefully
                    return;
                  }

                  // Check for error responses from backend
                  if (!parsed.isSuccess && parsed.errors && parsed.errors.length > 0) {
                    clearInterval(timeoutCheck);
                    reader.cancel();
                    onError(new Error(parsed.errors[0]?.errorMessage || 'Server error'));
                    return;
                  }

                  onChunk(parsed);
                } catch (parseError) {
                  console.error('[SSEStream] Parse error:', parseError);
                }
              }
            }
          }
        } catch (streamError) {
          clearInterval(timeoutCheck);
          onError(streamError);
        }
      };

      processStream();

      // Return cleanup function
      return {
        close: () => {
          clearInterval(timeoutCheck);
          reader.cancel();
        },
        readyState: 1
      } as any;

    } catch (err) {
      onError(err);
      return null;
    }
  }

  async runResponsesConversationStream(
    request: RunChatRequest,
    onChunk: (data: ChatMessagesResponse) => void,
    onComplete: () => void,
    onError: (error: any) => void
  ): Promise<EventSource | null> {
    // Use real streaming endpoint
    const url = `${this.baseUrl}/RunResponsesConversation`;
    // const url = `${this.baseUrl}/MockStreamBanana`;  // Keep for reference

    try {
      // Get auth token
      const token = await this.authService.getIdToken();
      if (!token) {
        onError(new Error('No auth token available'));
        return null;
      }

      // Get timezone and client version for headers
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const clientVersion = '1.0.0';

      // Send POST request with streaming response
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'X-Timezone': timezone,
          'X-Client-Version': clientVersion
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('HTTP error response:', errorText);
        // Note: Chat messages no longer get 403 - they go through in RestrictedAccess mode
        // The AI will handle prompting the user to upgrade
        onError(new Error(`HTTP error! status: ${response.status}`));
        return null;
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        onError(new Error('No response body'));
        return null;
      }

      let buffer = '';

      // Add timeout tracking
      let lastChunkTime = Date.now();

      const timeoutCheck = setInterval(() => {
        if (Date.now() - lastChunkTime > this.STREAM_TIMEOUT_MS) {
          console.error('Stream timeout - no data for 60 seconds');
          clearInterval(timeoutCheck);
          reader.cancel();
          onError(new Error('Stream timeout - no data received for 30 seconds'));
        }
      }, this.TIMEOUT_CHECK_INTERVAL_MS);

      // Process the stream
      const processStream = async () => {
        try {
          let iterationCount = 0; 

          while (true) {
            iterationCount++; 
            const { done, value } = await reader.read();

            if (done) {
             
              clearInterval(timeoutCheck);
              onComplete();
              break;
            }

            // Update activity timestamp
            lastChunkTime = Date.now();

            // Decode the chunk and add to buffer
            const chunk = decoder.decode(value, { stream: true });
            
            buffer += chunk;

            // Process complete lines
            const lines = buffer.split('\n');
            buffer = lines.pop() || ''; // Keep incomplete line in buffer

           
            for (const line of lines) {
              if (line.trim() === '') {
               
                continue;
              }

              if (line.startsWith('data: ')) {
                try {
                  const jsonData = line.substring(6);
                 
                  const rawData = JSON.parse(jsonData);

                  // Use the generated fromJS method to properly deserialize nested objects
                  // This ensures ServingIdentifier and other complex objects have their toJSON methods
                  const parsed = ChatMessagesResponse.fromJS(rawData);
                  

                  // Check for error responses from backend
                  if (!parsed.isSuccess && parsed.errors && parsed.errors.length > 0) {
                    
                    clearInterval(timeoutCheck);
                    reader.cancel();
                    onError(new Error(parsed.errors[0]?.errorMessage || 'Server error'));
                    return;
                  }


                  onChunk(parsed);
                  
                } catch (err) {
                 
                }
              } else {
                
              }
            }
          }
        } catch (err) {
         
          clearInterval(timeoutCheck);
          onError(err);
        }
      };

      // Start processing
      processStream();

      // Return cleanup function
      return {
        close: () => {
          clearInterval(timeoutCheck);
          reader.cancel();
        },
        readyState: 1
      } as any;

    } catch (err) {
      
      onError(err);
      return null;
    }
  }

  /**
   * Streams barcode scan results with exact match and alternatives
   */
  async barcodeScanStream(
    request: BarcodeSearchRequest,
    onChunk: (data: SearchFoodPhraseResponse) => void,
    onComplete: () => void,
    onError: (error: any) => void
  ): Promise<any | null> {
    const url = `${environment.backendApiUrl}/api/FoodSelection/SearchBarcode`;
    return this.handleSSEStream(url, request, SearchFoodPhraseResponse, onChunk, onComplete, onError);
  }

  /**
   * Streams AI-parsed food data for direct meal logging
   */
  async directLogMealStream(
    request: DirectLogMealRequest,
    onChunk: (data: SearchFoodPhraseResponse) => void,
    onComplete: () => void,
    onError: (error: any) => void
  ): Promise<any | null> {
    const url = `${environment.backendApiUrl}/api/FoodSelection/DirectLogMealStream`;
    return this.handleSSEStream(url, request, SearchFoodPhraseResponse, onChunk, onComplete, onError);
  }

  async setupGoalsStream(
    request: SetupGoalsRequest,
    onChunk: (data: ChatMessagesResponse) => void,
    onComplete: () => void,
    onError: (error: any) => void
  ): Promise<EventSource | null> {
    const url = `${this.baseUrl}/SetupGoals`;

    try {
      const token = await this.authService.getIdToken();
      if (!token) {
        onError(new Error('No auth token available'));
        return null;
      }

      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const clientVersion = '1.0.0';

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'X-Timezone': timezone,
          'X-Client-Version': clientVersion
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[SetupGoals] HTTP error response:', errorText);

        // Check for 403 restricted access response
        if (response.status === 403) {
          try {
            const errorData = JSON.parse(errorText);
            if (errorData.isRestricted) {
              this.restrictedAccessService.handleRestrictedAccess(
                errorData.phase || '',
                errorData.redirectUrl || ''
              );
              onComplete(); // Complete gracefully instead of error
              return null;
            }
          } catch {
            // Not a JSON response, continue with normal error handling
          }
        }

        onError(new Error(`HTTP error! status: ${response.status}`));
        return null;
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        onError(new Error('No response body'));
        return null;
      }

      let buffer = '';
      let lastChunkTime = Date.now();

      const timeoutCheck = setInterval(() => {
        if (Date.now() - lastChunkTime > this.STREAM_TIMEOUT_MS) {
          console.error('[SetupGoals] Stream timeout');
          clearInterval(timeoutCheck);
          reader.cancel();
          onError(new Error('Stream timeout - no data received'));
        }
      }, this.TIMEOUT_CHECK_INTERVAL_MS);

      const processStream = async () => {
        try {
          while (true) {
            const { done, value } = await reader.read();

            if (done) {
              clearInterval(timeoutCheck);
              onComplete();
              break;
            }

            lastChunkTime = Date.now();
            const chunk = decoder.decode(value, { stream: true });
            buffer += chunk;

            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (line.trim() === '') continue;

              if (line.startsWith('data: ')) {
                try {
                  const jsonData = line.substring(6);
                  const rawData = JSON.parse(jsonData);
                  const parsed = ChatMessagesResponse.fromJS(rawData);

                  if (!parsed.isSuccess && parsed.errors && parsed.errors.length > 0) {
                    console.error('[SetupGoals] Error response:', parsed.errors);
                    clearInterval(timeoutCheck);
                    reader.cancel();
                    onError(new Error(parsed.errors[0]?.errorMessage || 'Server error'));
                    return;
                  }

                  onChunk(parsed);
                } catch (err) {
                  console.error('[SetupGoals] Parse error:', err);
                }
              }
            }
          }
        } catch (err) {
          console.error('[SetupGoals] Stream processing error:', err);
          clearInterval(timeoutCheck);
          onError(err);
        }
      };

      processStream();

      return {
        close: () => {
          clearInterval(timeoutCheck);
          reader.cancel();
        },
        readyState: 1
      } as any;

    } catch (err) {
      console.error('[SetupGoals] Stream start error', err);
      onError(err);
      return null;
    }
  }

  async learnMoreAboutStream(
    request: LearnMoreAboutRequest,
    onChunk: (data: ChatMessagesResponse) => void,
    onComplete: () => void,
    onError: (error: any) => void
  ): Promise<EventSource | null> {
    const url = `${this.baseUrl}/LearnMoreAbout`;

    try {
      const token = await this.authService.getIdToken();
      if (!token) {
        onError(new Error('No auth token available'));
        return null;
      }

      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const clientVersion = '1.0.0';

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'X-Timezone': timezone,
          'X-Client-Version': clientVersion
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[LearnMoreAbout] HTTP error response:', errorText);

        // Check for 403 restricted access response
        if (response.status === 403) {
          try {
            const errorData = JSON.parse(errorText);
            if (errorData.isRestricted) {
              this.restrictedAccessService.handleRestrictedAccess(
                errorData.phase || '',
                errorData.redirectUrl || ''
              );
              onComplete(); // Complete gracefully instead of error
              return null;
            }
          } catch {
            // Not a JSON response, continue with normal error handling
          }
        }

        onError(new Error(`HTTP error! status: ${response.status}`));
        return null;
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        onError(new Error('No response body'));
        return null;
      }

      let buffer = '';
      let lastChunkTime = Date.now();

      const timeoutCheck = setInterval(() => {
        if (Date.now() - lastChunkTime > this.STREAM_TIMEOUT_MS) {
          console.error('[LearnMoreAbout] Stream timeout');
          clearInterval(timeoutCheck);
          reader.cancel();
          onError(new Error('Stream timeout - no data received'));
        }
      }, this.TIMEOUT_CHECK_INTERVAL_MS);

      const processStream = async () => {
        try {
          while (true) {
            const { done, value } = await reader.read();

            if (done) {
              clearInterval(timeoutCheck);
              onComplete();
              break;
            }

            lastChunkTime = Date.now();
            const chunk = decoder.decode(value, { stream: true });
            buffer += chunk;

            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (line.trim() === '') continue;

              if (line.startsWith('data: ')) {
                try {
                  const jsonData = line.substring(6);
                  const rawData = JSON.parse(jsonData);
                  const parsed = ChatMessagesResponse.fromJS(rawData);

                  if (!parsed.isSuccess && parsed.errors && parsed.errors.length > 0) {
                    console.error('[LearnMoreAbout] Error response:', parsed.errors);
                    clearInterval(timeoutCheck);
                    reader.cancel();
                    onError(new Error(parsed.errors[0]?.errorMessage || 'Server error'));
                    return;
                  }

                  onChunk(parsed);
                } catch (err) {
                  console.error('[LearnMoreAbout] Parse error:', err);
                }
              }
            }
          }
        } catch (err) {
          console.error('[LearnMoreAbout] Stream processing error:', err);
          clearInterval(timeoutCheck);
          onError(err);
        }
      };

      processStream();

      return {
        close: () => {
          clearInterval(timeoutCheck);
          reader.cancel();
        },
        readyState: 1
      } as any;

    } catch (err) {
      console.error('[LearnMoreAbout] Stream start error', err);
      onError(err);
      return null;
    }
  }

  /**
   * Triggers conversation continuation after a guest upgrades to a registered account.
   * Uses developer message only - no user message is shown in chat history.
   */
  async triggerConversationContinuationStream(
    request: TriggerConversationContinuationRequest,
    onChunk: (data: ChatMessagesResponse) => void,
    onComplete: () => void,
    onError: (error: any) => void
  ): Promise<EventSource | null> {
    const url = `${this.baseUrl}/TriggerConversationContinuation`;

    try {
      const token = await this.authService.getIdToken();
      if (!token) {
        onError(new Error('No auth token available'));
        return null;
      }

      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const clientVersion = '1.0.0';

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'X-Timezone': timezone,
          'X-Client-Version': clientVersion
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[TriggerConversationContinuation] HTTP error response:', errorText);
        onError(new Error(`HTTP error! status: ${response.status}`));
        return null;
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        onError(new Error('No response body'));
        return null;
      }

      let buffer = '';
      let lastChunkTime = Date.now();

      const timeoutCheck = setInterval(() => {
        if (Date.now() - lastChunkTime > this.STREAM_TIMEOUT_MS) {
          console.error('[TriggerConversationContinuation] Stream timeout');
          clearInterval(timeoutCheck);
          reader.cancel();
          onError(new Error('Stream timeout - no data received'));
        }
      }, this.TIMEOUT_CHECK_INTERVAL_MS);

      const processStream = async () => {
        try {
          while (true) {
            const { done, value } = await reader.read();

            if (done) {
              clearInterval(timeoutCheck);
              onComplete();
              break;
            }

            lastChunkTime = Date.now();
            const chunk = decoder.decode(value, { stream: true });
            buffer += chunk;

            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (line.trim() === '') continue;

              if (line.startsWith('data: ')) {
                try {
                  const jsonData = line.substring(6);
                  const rawData = JSON.parse(jsonData);
                  const parsed = ChatMessagesResponse.fromJS(rawData);

                  if (!parsed.isSuccess && parsed.errors && parsed.errors.length > 0) {
                    console.error('[TriggerConversationContinuation] Error response:', parsed.errors);
                    clearInterval(timeoutCheck);
                    reader.cancel();
                    onError(new Error(parsed.errors[0]?.errorMessage || 'Server error'));
                    return;
                  }

                  onChunk(parsed);
                } catch (err) {
                  console.error('[TriggerConversationContinuation] Parse error:', err);
                }
              }
            }
          }
        } catch (err) {
          console.error('[TriggerConversationContinuation] Stream processing error:', err);
          clearInterval(timeoutCheck);
          onError(err);
        }
      };

      processStream();

      return {
        close: () => {
          clearInterval(timeoutCheck);
          reader.cancel();
        },
        readyState: 1
      } as any;

    } catch (err) {
      console.error('[TriggerConversationContinuation] Stream start error', err);
      onError(err);
      return null;
    }
  }
}
