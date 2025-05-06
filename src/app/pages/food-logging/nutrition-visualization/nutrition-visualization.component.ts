import { Component, Input, OnInit, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { Chart, registerables } from 'chart.js';
import { FormsModule } from '@angular/forms';

Chart.register(...registerables);

@Component({
  selector: 'app-nutrition-visualization',
  templateUrl: './nutrition-visualization.component.html',
  styleUrls: ['./nutrition-visualization.component.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule, FormsModule]
})
export class NutritionVisualizationComponent implements OnInit, OnChanges {
  @Input() nutritionData: any;
  
  activeTab: string = 'macros';
  macroChart: Chart | null = null;
  microChart: Chart | null = null;
  
  // Nutrition summary data
  calories: number = 0;
  protein: number = 0;
  carbs: number = 0;
  fat: number = 0;
  fiber: number = 0;
  sugar: number = 0;
  
  // Detailed nutrition data
  nutrients: any[] = [];
  vitamins: any[] = [];
  minerals: any[] = [];

  constructor() { }

  ngOnInit() {}

  ngOnChanges() {
    if (this.nutritionData) {
      this.processNutritionData();
      this.renderCharts();
    }
  }

  processNutritionData() {
    if (!this.nutritionData || !this.nutritionData.foods || this.nutritionData.foods.length === 0) {
      return;
    }
  
    const data = this.nutritionData.foods[0]; // 👈 get the first food item
  
    // Process summary data
    this.calories = data.calories || 0;
    this.protein = data.macronutrients?.protein?.amount || 0;
    this.carbs = data.macronutrients?.carbohydrates?.amount || 0;
    this.fat = data.macronutrients?.fat?.amount || 0;
    this.fiber = data.macronutrients?.fiber?.amount || 0;
    this.sugar = data.macronutrients?.sugar?.amount || 0;
    
    // Process detailed nutrition data (micronutrients dictionary → array)
    this.nutrients = Object.keys(data.micronutrients || {}).map(key => ({
      name: key,
      amount: data.micronutrients[key].amount,
      unit: data.micronutrients[key].unit,
      dailyValue: data.micronutrients[key].daily_value_percent
    }));
  
    this.vitamins = this.nutrients.filter(n => n.name.includes('Vitamin'));
    this.minerals = this.nutrients.filter(n => !n.name.includes('Vitamin'));
  }
  

  findNutrientValue(nutrients: any[], name: string): number {
    const nutrient = nutrients?.find(n => n.name === name);
    return nutrient ? nutrient.amount : 0;
  }

  renderCharts() {
    this.renderMacroChart();
    this.renderMicroChart();
  }

  renderMacroChart() {
    const canvas = document.getElementById('macroChart') as HTMLCanvasElement;
    if (!canvas) return;

    // Destroy previous chart instance if it exists
    if (this.macroChart) {
      this.macroChart.destroy();
    }

    // Calculate total macros for percentage
    const totalMacros = this.protein + this.carbs + this.fat;
    
    // Create new chart
    this.macroChart = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: ['Protein', 'Carbs', 'Fat'],
        datasets: [{
          data: [this.protein, this.carbs, this.fat],
          backgroundColor: [
            'rgba(54, 162, 235, 0.8)',
            'rgba(255, 206, 86, 0.8)',
            'rgba(255, 99, 132, 0.8)'
          ],
          borderColor: [
            'rgba(54, 162, 235, 1)',
            'rgba(255, 206, 86, 1)',
            'rgba(255, 99, 132, 1)'
          ],
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            position: 'bottom',
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                const value = context.raw as number;
                const percentage = totalMacros > 0 ? Math.round((value / totalMacros) * 100) : 0;
                return `${context.label}: ${value}g (${percentage}%)`;
              }
            }
          }
        }
      }
    });
  }

  renderMicroChart() {
    const canvas = document.getElementById('microChart') as HTMLCanvasElement;
    if (!canvas) return;

    // Destroy previous chart instance if it exists
    if (this.microChart) {
      this.microChart.destroy();
    }

    // Get top 5 micronutrients by percentage of daily value
    const topMicronutrients = [...this.vitamins, ...this.minerals]
      .filter(n => n.dailyValue && n.dailyValue > 0)
      .sort((a, b) => (b.amount / b.dailyValue) - (a.amount / a.dailyValue))
      .slice(0, 5);

    const labels = topMicronutrients.map(n => n.name);
    const data = topMicronutrients.map(n => Math.min((n.amount / n.dailyValue) * 100, 100)); // Cap at 100%

    // Create new chart
    this.microChart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: '% of Daily Value',
          data: data,
          backgroundColor: 'rgba(75, 192, 192, 0.8)',
          borderColor: 'rgba(75, 192, 192, 1)',
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        scales: {
          y: {
            beginAtZero: true,
            max: 100,
            title: {
              display: true,
              text: '% of Daily Value'
            }
          }
        },
        plugins: {
          legend: {
            display: false
          }
        }
      }
    });
  }

  segmentChanged(event: any) {
    this.activeTab = event.detail.value;
    // Re-render charts when switching to the charts tab
    if (this.activeTab === 'charts') {
      setTimeout(() => {
        this.renderCharts();
      }, 100);
    }
  }

  
}
