import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.nutritionambition.mobile',
  appName: 'Nutrition Ambition',
  webDir: 'dist',
  android: {
    buildOptions: {
      javaVersion: '17'
    }
  },
  ios: {
    // Minimum iOS version required for MLKit Barcode Scanning
    minVersion: '15.5'
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      backgroundColor: '#ffffff',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      androidSpinnerStyle: 'large',
      iosSpinnerStyle: 'small',
      spinnerColor: '#999999'
    },
    Keyboard: {
      // Resize the web view when keyboard opens so footer stays visible
      resize: 'body',
      // Scroll to focused input on keyboard open
      scrollPadding: true
    }
  }
};

export default config;


