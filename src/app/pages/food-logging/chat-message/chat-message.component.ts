import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';

export interface ChatMessage {
  sender: 'user' | 'ai';
  text: string;
  timestamp?: Date;
  nutritionData?: any; // To know if details are available
}

@Component({
  selector: 'app-chat-message',
  templateUrl: './chat-message.component.html',
  styleUrls: ['./chat-message.component.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule]
})
export class ChatMessageComponent {
  @Input() message!: ChatMessage;
  @Output() viewDetails = new EventEmitter<any>();

  constructor() { }

  onViewDetailsClick() {
    if (this.message.nutritionData) {
      this.viewDetails.emit(this.message.nutritionData);
    }
  }
}

