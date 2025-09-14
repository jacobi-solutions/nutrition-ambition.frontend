import { Component, ComponentMatch, Food } from '../services/nutrition-ambition-api.service';

/**
 * Display extensions for food selection components
 * These interfaces add UI state flags to the API models
 */

export class ComponentDisplay extends Component {
  // Display state flags
  isSearching?: boolean;
  isEditing?: boolean;
  isExpanded?: boolean;
  editingValue?: string;
  showingMoreOptions?: boolean;
  loadingMoreOptions?: boolean;
  loadingInstantOptions?: boolean;
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
    this.moreOptions = data.moreOptions;
    this.matches = data.matches;
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
      this.moreOptions = _data["moreOptions"];
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
    data["moreOptions"] = this.moreOptions;
    if (Array.isArray(this.matches)) {
      data["matches"] = [];
      for (let item of this.matches)
        data["matches"].push(item.toJSON());
    }
    return data;
  }
}

export class ComponentMatchDisplay extends ComponentMatch {
  // Loading state flags
  isNewAddition?: boolean;
  isEditingPhrase?: boolean;

  constructor(data: Partial<ComponentMatchDisplay> = {}) {
    super(data);
    this.isNewAddition = data.isNewAddition;
    this.isEditingPhrase = data.isEditingPhrase;
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
    }
  }

  toJSON(data?: any) {
    data = super.toJSON(data);
    data["isNewAddition"] = this.isNewAddition;
    data["isEditingPhrase"] = this.isEditingPhrase;
    return data;
  }
}

export class FoodDisplay extends Food {
  // Food-level display flags
  isExpanded?: boolean;
  isEditing?: boolean;
  isEditingExpanded?: boolean;

  // Precomputed data to eliminate method calls in template
  computedComponents?: ComponentDataDisplay[];

  // Enhanced components with display flags
  components?: ComponentDisplay[] | undefined;

  constructor(data: Partial<FoodDisplay> = {}) {
    super(data);
    this.isExpanded = data.isExpanded;
    this.isEditing = data.isEditing;
    this.isEditingExpanded = data.isEditingExpanded;
    this.computedComponents = data.computedComponents;
    this.components = data.components;
  }

  init(_data?: any) {
    super.init(_data);
    if (_data) {
      this.isExpanded = _data["isExpanded"];
      this.isEditing = _data["isEditing"];
      this.isEditingExpanded = _data["isEditingExpanded"];
      this.computedComponents = _data["computedComponents"];
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
    data["computedComponents"] = this.computedComponents;
    if (Array.isArray(this.components)) {
      data["components"] = [];
      for (let item of this.components)
        data["components"].push(item.toJSON());
    }
    return data;
  }
}

/**
 * Helper type for component data used in templates
 */
export interface ComponentDataDisplay {
  componentId: string;
  component: ComponentDisplay;
  isSingleComponentFood?: boolean;
  parentQuantity?: number;
}