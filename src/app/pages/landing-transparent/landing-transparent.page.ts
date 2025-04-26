
import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { IonButton, IonContent, IonHeader, IonInput, IonTitle, IonToolbar } from '@ionic/angular/standalone';
import { FoodEntryService } from '../../services/food-entry.service';
import { FoodEntry, FoodItem, GetFoodEntriesResponse } from '../../services/nutrition-ambition-api.service';
import { FoodEntryComponent } from '../../components/food-entry/food-entry.component';
import { AuthService } from '../../services/auth.service';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { UserEngagementService } from 'src/app/services/user-engagement.service';


@Component({
  selector: 'app-landing-transparent',  
  templateUrl: './landing-transparent.page.html',
  styleUrls: ['./landing-transparent.page.scss'],
  standalone: true,
  imports: [IonContent, CommonModule, FormsModule, ReactiveFormsModule, IonInput, IonButton]
})
export class LandingTransparentPage implements OnInit {
  emailForm: FormGroup;

  constructor(
    private fb: FormBuilder,
    private _userEngagementService: UserEngagementService
  ) {}

  ngOnInit(): void {
    this.emailForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]]
    });
  }

  submitEmail() {
    if (this.emailForm.valid) {
      const email = this.emailForm.value.email;
      this._userEngagementService.saveUserEngagement(email);
      this.emailForm.reset();
      alert('Thank you! You\'ll hear from us soon.');
    }
  }
}