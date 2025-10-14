import { Injectable } from '@angular/core';
import { environment } from 'src/environments/environment';
import { ChatMessagesResponse, RunChatRequest } from './nutrition-ambition-api.service';
import { AuthService } from './auth.service';
import { DateService } from './date.service';

@Injectable({ providedIn: 'root' })
export class ChatStreamService {
  private baseUrl = `${environment.backendApiUrl}/api/conversation`;

  // Streaming timeout configuration
  private readonly STREAM_TIMEOUT_MS = 30000; // 30 seconds of inactivity
  private readonly TIMEOUT_CHECK_INTERVAL_MS = 5000; // Check every 5 seconds

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
          console.log('🔵 Stream started - reader:', !!reader, 'response.body:', !!response.body);
          let iterationCount = 0;

          while (true) {
            iterationCount++;
            console.log(`🔵 Read iteration ${iterationCount} starting...`);
            const { done, value } = await reader.read();
            console.log(`🔵 Read result ${iterationCount}:`, { done, hasValue: !!value, valueLength: value?.length });

            if (done) {
              console.log('🟢 Stream complete after', iterationCount, 'iterations. Buffer remaining:', buffer.length, 'chars');
              clearInterval(timeoutCheck);
              onComplete();
              break;
            }

            // Update activity timestamp
            lastChunkTime = Date.now();

            // Decode the chunk and add to buffer
            const chunk = decoder.decode(value, { stream: true });
            console.log('🟡 Raw stream chunk length:', chunk.length, 'preview:', chunk.substring(0, 100));
            buffer += chunk;

            // Process complete lines
            const lines = buffer.split('\n');
            buffer = lines.pop() || ''; // Keep incomplete line in buffer

            console.log('Processing', lines.length, 'lines');
            for (const line of lines) {
              if (line.trim() === '') continue;

              if (line.startsWith('data: ')) {
                try {
                  const jsonData = line.substring(6);
                  console.log('SSE raw data:', jsonData.substring(0, 200)); // Log first 200 chars
                  const parsed = JSON.parse(jsonData) as ChatMessagesResponse;
                  console.log('SSE parsed chunk:', parsed);

                  // Check for error responses from backend
                  if (!parsed.isSuccess && parsed.errors && parsed.errors.length > 0) {
                    clearInterval(timeoutCheck);
                    reader.cancel();
                    onError(new Error(parsed.errors[0]?.errorMessage || 'Server error'));
                    return;
                  }

                  onChunk(parsed);
                } catch (err) {
                  console.error('Stream parse error for line:', line, err);
                }
              }
            }
          }
        } catch (err) {
          console.error('Stream read error', err);
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
      console.error('Stream start error', err);
      onError(err);
      return null;
    }
  }
}
