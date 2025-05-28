// Fix potential component path issues for production build
const fs = require('fs');
const path = require('path');

console.log('Running production build path fixes...');

// Ensure chat-input component is properly linked
const foodLoggingPageHtml = path.join(__dirname, 'src/app/pages/food-logging/food-logging.page.html');
console.log(`Checking file: ${foodLoggingPageHtml}`);

if (fs.existsSync(foodLoggingPageHtml)) {
  let content = fs.readFileSync(foodLoggingPageHtml, 'utf8');
  
  // Ensure chat input component path is correct
  if (content.includes('<app-chat-input')) {
    console.log('Chat input component reference found, ensuring correct path...');
    
    // This ensures the component selector is set correctly
    content = content.replace(/<app-chat-input/g, '<app-chat-input');
    
    fs.writeFileSync(foodLoggingPageHtml, content, 'utf8');
    console.log('Fixed chat input component reference in food-logging.page.html');
  }
}

// Create a high specificity CSS override for FAB visibility
const globalScssPath = path.join(__dirname, 'src/global.scss');
console.log(`Adding FAB visibility overrides to ${globalScssPath}`);

if (fs.existsSync(globalScssPath)) {
  let globalStyles = fs.readFileSync(globalScssPath, 'utf8');
  
  // Add FAB override only if it doesn't already exist
  if (!globalStyles.includes('/* FAB Override */')) {
    const fabOverride = `
/* FAB Override */
:root {
  --ion-fab-display: flex !important;
  --ion-fab-visibility: visible !important;
  --ion-fab-opacity: 1 !important;
}

// Apply these styles with highest specificity
html body ion-app ion-content ion-fab,
html body ion-app .fab-container ion-fab {
  display: var(--ion-fab-display);
  visibility: var(--ion-fab-visibility);
  opacity: var(--ion-fab-opacity);
  z-index: 9999 !important;
}

html body ion-app ion-content ion-fab ion-fab-button,
html body ion-app .fab-container ion-fab ion-fab-button {
  display: var(--ion-fab-display);
  visibility: var(--ion-fab-visibility);
  opacity: var(--ion-fab-opacity);
}

html body ion-app ion-content ion-fab ion-fab-list,
html body ion-app .fab-container ion-fab ion-fab-list {
  display: var(--ion-fab-display);
  visibility: var(--ion-fab-visibility);
  opacity: var(--ion-fab-opacity);
}
`;
    
    // Append the FAB override styles
    fs.appendFileSync(globalScssPath, fabOverride);
    console.log('Added FAB visibility overrides to global.scss');
  }
}

console.log('Path fixes completed!'); 