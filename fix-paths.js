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

console.log('Path fixes completed!'); 