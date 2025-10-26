// This file can be replaced during build by using the `fileReplacements` array.
// `ng build` replaces `environment.ts` with `environment.prod.ts`.
// The list of file replacements can be found in `angular.json`.

export const environment = {
  production: false,
  // backendApiUrl: 'https://dev-backend-496562523884.us-central1.run.app',
  backendApiUrl: 'http://localhost:5165',
  frontendUrl: 'http://localhost:8100',

  storageBucketBaseUrl: 'https://storage.googleapis.com/nutritionambition.app',
  authDebug: true,
  firebase: {
    apiKey: "AIzaSyAUPErnsxJ7DReXiat7PdppoV-Apbpyxt8",
    authDomain: "nutrition-ambition.firebaseapp.com",
    projectId: "nutrition-ambition",
    storageBucket: "nutrition-ambition.firebasestorage.app",
    messagingSenderId: "496562523884",
    appId: "1:496562523884:web:aae9cec957ae6d491f1fc9",
    measurementId: "G-YR1NTFC9TN"
  },
  tenantId: 'development-096qj'
};

/*
 * For easier debugging in development mode, you can import the following file
 * to ignore zone related error stack frames such as `zone.run`, `zoneDelegate.invokeTask`.
 *
 * This import should be commented out in production mode because it will have a negative impact
 * on performance if an error is thrown.
 */
// import 'zone.js/plugins/zone-error';  // Included with Angular CLI.
