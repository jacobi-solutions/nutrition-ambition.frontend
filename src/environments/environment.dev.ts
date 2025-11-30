// This file can be replaced during build by using the `fileReplacements` array.
// `ng build` replaces `environment.ts` with `environment.prod.ts`.
// The list of file replacements can be found in `angular.json`.

export const environment = {
  production: false,
  backendApiUrl: 'https://dev-api.nutritionambition.app',
  frontendUrl: 'https://dev.nutritionambition.app',

  storageBucketBaseUrl: 'https://storage.googleapis.com/nutritionambition.app',
  authDebug: true,
  firebase: {
    "projectId": "nutrition-ambition",
    "appId": "1:496562523884:web:d709330c10dbcc761f1fc9",
    "storageBucket": "nutrition-ambition.firebasestorage.app",
    "apiKey": "AIzaSyAUPErnsxJ7DReXiat7PdppoV-Apbpyxt8",
    "authDomain": "nutrition-ambition.firebaseapp.com",
    "messagingSenderId": "496562523884",
    "measurementId": "G-9EEG64HG46"
  },
  tenantId: 'development-096qj',
  stripePrices: {
    publicMonthly: 'price_1SZFNbGxHs6evYLl0KopKacx',
    public6Month: 'price_1SZFOOGxHs6evYLlRVFXvaRh',
    public12Month: 'price_1SZFOjGxHs6evYLlEaX0AfZF',
    earlyMonthly: 'price_1SZFP1GxHs6evYLlWTkgMrWa',
    early6Month: 'price_1SZFPGGxHs6evYLl3fHeRMwW',
    early12Month: 'price_1SZFPWGxHs6evYLlUG3ZgcTq',
    earlyLifetime: 'price_1SZFPfGxHs6evYLlNmFNtELw'
  }
};

/*
 * For easier debugging in development mode, you can import the following file
 * to ignore zone related error stack frames such as `zone.run`, `zoneDelegate.invokeTask`.
 *
 * This import should be commented out in production mode because it will have a negative impact
 * on performance if an error is thrown.
 */
// import 'zone.js/plugins/zone-error';  // Included with Angular CLI.
