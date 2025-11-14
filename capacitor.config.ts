import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.nutritionambition.mobile',
  appName: 'Nutrition Ambition',
  webDir: 'dist',
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
    }
  }
};

export default config;


