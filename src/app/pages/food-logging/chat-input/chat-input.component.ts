import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';

@Component({
  selector: 'app-chat-input',
  templateUrl: './chat-input.component.html',
  styleUrls: ['./chat-input.component.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule]
})
export class ChatInputComponent {
  @Output() newMessage = new EventEmitter<string>();
  inputText: string = '';

  constructor() { }

  sendMessage() {
    const text = this.inputText.trim();
    if (text) {
      this.newMessage.emit(text);
      this.inputText = ''; // Clear input after sending
    }
  }
}

