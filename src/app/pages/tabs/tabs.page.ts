import { Component } from '@angular/core';
// Import specific standalone components from @ionic/angular/standalone
import { IonTabs, IonTabBar, IonTabButton, IonIcon, IonLabel } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { barChartOutline } from 'ionicons/icons';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-tabs',
  templateUrl: './tabs.page.html',
  styleUrls: ['./tabs.page.scss'],
  standalone: true,
  // Import the specific standalone components needed by the template
  imports: [IonTabs, IonTabBar, IonTabButton, RouterLink]
})
export class TabsPage {

  constructor() {
    // Add the icons explicitly to the library
    addIcons({ barChartOutline });
  }

}

