# Frontend UI Design for Nutrition Summaries

## Goal
Provide users with an easy way to view their logged food entries and nutrition summaries at different levels (daily, meal, individual item) and navigate between the chat interface and these views.

## Proposed Design

1.  **Navigation:**
    *   Implement bottom tabs using `<ion-tabs>`.
    *   **Tab 1: Chat:** Links to the existing `FoodLoggingPage` (renamed or kept as is).
    *   **Tab 2: Log:** Links to a new page, `NutritionLogPage`, responsible for displaying summaries and logged items.

2.  **Nutrition Log Page (`NutritionLogPage`):**
    *   **Layout:** Use `<ion-header>`, `<ion-content>`.
    *   **Header:**
        *   Title: "Nutrition Log"
        *   Date Selector: An `<ion-datetime>` component bound to `presentation="date"` to allow users to select a specific day. Buttons for "Previous Day" and "Next Day" could also be added for quick navigation.
    *   **Content:**
        *   **Daily Summary Card:** Display key daily totals (Calories, Protein, Carbs, Fat) fetched from the `GetFoodEntriesResponse.totalCalories`, etc. for the selected date.
        *   **Meal Groups:** Group the `FoodEntry` items fetched for the selected date by `MealType` (Breakfast, Lunch, Dinner, Snack).
            *   Use `<ion-list>` with `<ion-item-group>` for each meal.
            *   Include an `<ion-item-divider>` for each meal type title.
            *   Display each `FoodEntry` as an `<ion-item>`.
        *   **Food Entry Display (`<ion-item>`):**
            *   Show the original `FoodEntry.Description`.
            *   Maybe show the time it was logged.
            *   Make the item clickable to drill down.
        *   **Drill-down (Option 1: Expansion):**
            *   Clicking a `FoodEntry` item expands it in place.
            *   Show the list of `ParsedItems` (`FoodItem`) within the expanded view.
            *   Each `FoodItem` shows its name and calories.
            *   Clicking a `FoodItem` opens the detailed nutrition modal.
        *   **Drill-down (Option 2: Separate Detail View/Modal):**
            *   Clicking a `FoodEntry` item navigates to a new detail page or opens a modal displaying all its `ParsedItems`.
            *   Clicking a `FoodItem` within that view/modal opens the detailed nutrition modal.
        *   **Detailed Nutrition Modal:** Reuse the existing modal implementation from `FoodLoggingPage` which uses `NutritionVisualizationComponent` to show the full details of a selected `FoodItem` (or potentially a combined view for a full `FoodEntry`).

## Implementation Steps

1.  Modify `app.routes.ts` and potentially `app.component.html` to set up the tabbed navigation structure.
2.  Create the `NutritionLogPage` component (`.ts`, `.html`, `.scss`).
3.  Implement the date selection logic in `NutritionLogPage`.
4.  Implement the API call (`GetFoodEntries`) in `NutritionLogPage` to fetch data for the selected date.
5.  Implement the display of daily summaries and grouped food entries in `NutritionLogPage.html`.
6.  Implement the chosen drill-down mechanism (expansion or separate view/modal).
7.  Integrate the `NutritionVisualizationComponent` modal for viewing individual item details.

This design provides clear navigation and allows users to access both the conversational logging interface and their historical data with summaries.
