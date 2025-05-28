# Chat Interface Design

## Goal
Transform the food logging page into a chat-based interface where users interact with an AI nutrition coach.

## Requirements
1.  **Chat Display:** Standard chat layout showing user messages and AI responses.
2.  **Input Area:** User types food descriptions.
3.  **AI Response:** AI message appears in chat, summarizing logged food and key nutrition points.
4.  **Detailed Results:** Full nutrition data (using `NutritionVisualizationComponent`) accessible separately, not directly in the chat flow.

## Proposed Layout (`food-logging.page.html`)

-   **Header:** Title changed to "Nutrition Coach". Sign-out remains.
-   **Content:** A `div.chat-container` will display messages.
    -   Messages will be looped using `*ngFor` from a `messages` array.
    -   CSS classes (`user-message`, `ai-message`) will differentiate senders.
    -   AI messages containing nutrition data will have a "View Details" button.
-   **Footer:** A new `app-chat-input` component (refactored from `app-food-text-input`) will handle user input.
-   **Modal:** An `<ion-modal>` will contain the `app-nutrition-visualization` component to display detailed results when the "View Details" button is clicked.

## Component Changes

1.  **`FoodLoggingPage`:**
    -   Maintain an array `messages` (e.g., `{ sender: 'user' | 'ai', text: string, timestamp?: Date, nutritionData?: any }`).
    -   Handle input from `ChatInputComponent`.
    -   Call the API service (`processFoodTextAndGetNutrition`).
    -   Add user message and AI response (with `nutritionData` and `aiCoachResponse`) to the `messages` array.
    -   Manage modal state (`isModalOpen`, `selectedNutritionData`).
    -   Implement `showNutritionDetails(nutritionData)` method to open the modal.

2.  **`FoodTextInputComponent` -> `ChatInputComponent`:**
    -   Refactor to emit the raw text input via a `newMessage` event.
    -   Template simplified to an input field and send button.
    -   API call logic moved to `FoodLoggingPage`.

3.  **`NutritionVisualizationComponent`:**
    -   No changes needed. Will be displayed inside the modal.

## Data Flow

1.  User types message in `ChatInputComponent`.
2.  `ChatInputComponent` emits `newMessage` event with text.
3.  `FoodLoggingPage` receives event, adds user message to `messages` array.
4.  `FoodLoggingPage` calls `nutritionApiService.processFoodTextAndGetNutrition`.
5.  API returns `NutritionApiResponse` (including `aiCoachResponse` and `foods` data).
6.  `FoodLoggingPage` adds AI message (using `aiCoachResponse` as text and storing `foods` data) to `messages` array.
7.  Chat display updates.
8.  User clicks "View Details" on an AI message.
9.  `FoodLoggingPage.showNutritionDetails` sets `selectedNutritionData` and opens the modal.
10. Modal displays `NutritionVisualizationComponent` with the selected data.

