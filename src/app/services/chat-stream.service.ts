import { Injectable } from '@angular/core';
import { environment } from 'src/environments/environment';
import { ChatMessagesResponse, RunChatRequest, DirectLogMealRequest, SearchFoodPhraseResponse, SetupGoalsRequest, LearnMoreAboutRequest } from './nutrition-ambition-api.service';
import { AuthService } from './auth.service';
import { DateService } from './date.service';

@Injectable({ providedIn: 'root' })
export class ChatStreamService {
  private baseUrl = `${environment.backendApiUrl}/api/conversation`;

  // Streaming timeout configuration
  private readonly STREAM_TIMEOUT_MS = 60000; 
  private readonly TIMEOUT_CHECK_INTERVAL_MS = 5000; 

  constructor(
    private authService: AuthService,
    private dateService: DateService
  ) {}

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
          console.error('Stream timeout - no data for 30 seconds');
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
   * Streams food data directly from LogMeal tool to append to an existing message.
   * Used for AI search (sparkles icon) without creating new messages.
   */
  async directLogMealStream(
    request: DirectLogMealRequest,
    onChunk: (data: SearchFoodPhraseResponse) => void,
    onComplete: () => void,
    onError: (error: any) => void
  ): Promise<any | null> {
    const url = `${environment.backendApiUrl}/api/FoodSelection/DirectLogMealStream`;

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
          console.error('[DirectLogMeal] Stream timeout - no data for 60 seconds');
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

            lastChunkTime = Date.now();
            buffer += decoder.decode(value, { stream: true });

            // Split by double newlines to get SSE messages
            const lines = buffer.split('\n\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const jsonStr = line.substring(6);
                try {
                  const chunk = JSON.parse(jsonStr);
                  
                  onChunk(SearchFoodPhraseResponse.fromJS(chunk));
                } catch (parseError) {
                 
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
        console.error('LearnMoreAbout HTTP error:', errorText);
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
          console.error('LearnMoreAbout stream timeout');
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
}
