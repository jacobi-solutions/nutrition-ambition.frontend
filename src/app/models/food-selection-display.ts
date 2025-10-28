import { Component, ComponentMatch, ComponentServing, Food } from '../services/nutrition-ambition-api.service';

/**
 * Display extensions for food selection components
 * These interfaces add UI state flags to the API models
 */

export class ComponentDisplay extends Component {
  // Display state flags
  isSearching?: boolean;
  isNewAddition?: boolean;
  isEditing?: boolean;
  isExpanded?: boolean;
  editingValue?: string;
  showingMoreOptions?: boolean;
  loadingMoreOptions?: boolean;
  loadingInstantOptions?: boolean;
  isHydratingAlternateSelection?: boolean;
  moreOptions?: ComponentMatch[] | undefined;

  // Enhanced matches with display flags
  matches?: ComponentMatchDisplay[] | undefined;

  constructor(data: Partial<ComponentDisplay> = {}) {
    super(data);
    this.isSearching = data.isSearching;
    this.isEditing = data.isEditing;
    this.isExpanded = data.isExpanded;
    this.editingValue = data.editingValue;
    this.showingMoreOptions = data.showingMoreOptions;
    this.loadingMoreOptions = data.loadingMoreOptions;
    this.loadingInstantOptions = data.loadingInstantOptions;
    this.isHydratingAlternateSelection = data.isHydratingAlternateSelection;
    this.moreOptions = data.moreOptions;
    this.matches = data.matches;
    this.isNewAddition = data.isNewAddition;
  }

  init(_data?: any) {
    super.init(_data);
    if (_data) {
      this.isSearching = _data["isSearching"];
      this.isEditing = _data["isEditing"];
      this.isExpanded = _data["isExpanded"];
      this.editingValue = _data["editingValue"];
      this.showingMoreOptions = _data["showingMoreOptions"];
      this.loadingMoreOptions = _data["loadingMoreOptions"];
      this.loadingInstantOptions = _data["loadingInstantOptions"];
      this.isHydratingAlternateSelection = _data["isHydratingAlternateSelection"];
      this.moreOptions = _data["moreOptions"];
      this.isNewAddition = _data["isNewAddition"];
      if (Array.isArray(_data["matches"])) {
        this.matches = [] as any;
        for (let item of _data["matches"])
          this.matches!.push(ComponentMatchDisplay.fromJS ? ComponentMatchDisplay.fromJS(item) : new ComponentMatchDisplay(item));
      }
    }
  }

  toJSON(data?: any) {
    data = super.toJSON(data);
    data["isSearching"] = this.isSearching;
    data["isEditing"] = this.isEditing;
    data["isExpanded"] = this.isExpanded;
    data["editingValue"] = this.editingValue;
    data["showingMoreOptions"] = this.showingMoreOptions;
    data["loadingMoreOptions"] = this.loadingMoreOptions;
    data["loadingInstantOptions"] = this.loadingInstantOptions;
    data["isHydratingAlternateSelection"] = this.isHydratingAlternateSelection;
    data["moreOptions"] = this.moreOptions;
    data["isNewAddition"] = this.isNewAddition;
    if (Array.isArray(this.matches)) {
      data["matches"] = [];
      for (let item of this.matches)
        data["matches"].push(item.toJSON());
    }
    return data;
  }
}


export class FoodDisplay extends Food {
  // Food-level display flags
  isExpanded?: boolean;
  isEditing?: boolean;
  isEditingExpanded?: boolean;
  editingQuantity?: number;

  visibleComponentCount?: number;
  hasVisibleComponents?: boolean;

  // Nutrition calculation baseline
  initialQuantity?: number;

  // Stream tracking for concurrent searches
  streamId?: string;

  // Enhanced components with display flags
  components?: ComponentDisplay[] | undefined;

  constructor(data: Partial<FoodDisplay> = {}) {
    super(data);
    this.isExpanded = data.isExpanded;
    this.isEditing = data.isEditing;
    this.isEditingExpanded = data.isEditingExpanded;
    this.editingQuantity = data.editingQuantity;
    this.initialQuantity = data.initialQuantity;
    this.streamId = data.streamId;
    this.components = data.components;
  }

  init(_data?: any) {
    super.init(_data);
    if (_data) {
      this.isExpanded = _data["isExpanded"];
      this.isEditing = _data["isEditing"];
      this.isEditingExpanded = _data["isEditingExpanded"];
      this.editingQuantity = _data["editingQuantity"];
      this.initialQuantity = _data["initialQuantity"];
      this.streamId = _data["streamId"];
      if (Array.isArray(_data["components"])) {
        this.components = [] as any;
        for (let item of _data["components"])
          this.components!.push(new ComponentDisplay(item));
      }
    }
  }

  toJSON(data?: any) {
    data = super.toJSON(data);
    data["isExpanded"] = this.isExpanded;
    data["isEditing"] = this.isEditing;
    data["isEditingExpanded"] = this.isEditingExpanded;
    data["editingQuantity"] = this.editingQuantity;
    data["initialQuantity"] = this.initialQuantity;
    data["visibleComponentCount"] = this.visibleComponentCount;
    data["hasVisibleComponents"] = this.hasVisibleComponents;
    if (Array.isArray(this.components)) {
      data["components"] = [];
      for (let item of this.components)
        data["components"].push(item.toJSON());
    }
    return data;
  }
}

export class ComponentServingDisplay extends ComponentServing {
  // UI state flags
  isSelected?: boolean;
  effectiveQuantity?: number;
  unitText?: string;
  servingLabel?: string;

  // Serving multiplier fields for proper unit-to-serving conversion
  baseQuantity?: number;        // Original quantity per serving from backend (e.g., 2)
  baseUnit?: string;            // Original unit from backend (e.g., "tbsp")
  userSelectedQuantity?: number; // What the user selected (e.g., 3)
  servingMultiplier?: number;    // Calculated: userSelectedQuantity / baseQuantity

  constructor(data: Partial<ComponentServingDisplay> = {}) {
    super(data);
    this.isSelected = data.isSelected;
    this.effectiveQuantity = data.effectiveQuantity;
    this.unitText = data.unitText;
    this.servingLabel = data.servingLabel;
    this.baseQuantity = data.baseQuantity;
    this.baseUnit = data.baseUnit;
    this.userSelectedQuantity = data.userSelectedQuantity;
    this.servingMultiplier = data.servingMultiplier;
  }

  static fromJS(data: any): ComponentServingDisplay {
    data = typeof data === 'object' ? data : {};
    let result = new ComponentServingDisplay();
    result.init(data);
    return result;
  }

  init(_data?: any) {
    super.init(_data);
    if (_data) {
      this.isSelected = _data["isSelected"];
      this.effectiveQuantity = _data["effectiveQuantity"];
      this.unitText = _data["unitText"];
      this.servingLabel = _data["servingLabel"];
      this.baseQuantity = _data["baseQuantity"];
      this.baseUnit = _data["baseUnit"];
      this.userSelectedQuantity = _data["userSelectedQuantity"];
      this.servingMultiplier = _data["servingMultiplier"];
    }
  }

  toJSON(data?: any) {
    data = super.toJSON(data);
    data["isSelected"] = this.isSelected;
    data["effectiveQuantity"] = this.effectiveQuantity;
    data["unitText"] = this.unitText;
    data["servingLabel"] = this.servingLabel;
    data["baseQuantity"] = this.baseQuantity;
    data["baseUnit"] = this.baseUnit;
    data["userSelectedQuantity"] = this.userSelectedQuantity;
    data["servingMultiplier"] = this.servingMultiplier;
    return data;
  }
}

export class ComponentMatchDisplay extends ComponentMatch {
  // Loading state flags
  isNewAddition?: boolean;
  isEditingPhrase?: boolean;

  // Enhanced servings with display flags
  servings?: ComponentServingDisplay[] | undefined;

  constructor(data: Partial<ComponentMatchDisplay> = {}) {
    super(data);
    this.isNewAddition = data.isNewAddition;
    this.isEditingPhrase = data.isEditingPhrase;
    this.servings = data.servings;
  }

  static fromJS(data: any): ComponentMatchDisplay {
    data = typeof data === 'object' ? data : {};
    let result = new ComponentMatchDisplay();
    result.init(data);
    return result;
  }

  init(_data?: any) {
    super.init(_data);
    if (_data) {
      this.isNewAddition = _data["isNewAddition"];
      this.isEditingPhrase = _data["isEditingPhrase"];
      if (Array.isArray(_data["servings"])) {
        this.servings = [] as any;
        for (let item of _data["servings"])
          this.servings!.push(ComponentServingDisplay.fromJS ? ComponentServingDisplay.fromJS(item) : new ComponentServingDisplay(item));
      }
    }
  }

  toJSON(data?: any) {
    data = super.toJSON(data);
    data["isNewAddition"] = this.isNewAddition;
    data["isEditingPhrase"] = this.isEditingPhrase;
    if (Array.isArray(this.servings)) {
      data["servings"] = [];
      for (let item of this.servings)
        data["servings"].push(item.toJSON());
    }
    return data;
  }
}

