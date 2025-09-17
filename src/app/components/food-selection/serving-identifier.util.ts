import { ServingIdentifier } from '../../services/nutrition-ambition-api.service';

export class ServingIdentifierUtil {

  static areEqual(a: ServingIdentifier | null | undefined, b: ServingIdentifier | null | undefined): boolean {
    if (a == null && b == null) return true;
    if (a == null || b == null) return false;
    return a.provider === b.provider &&
           a.foodType === b.foodType &&
           a.foodName === b.foodName &&
           a.variantIndex === b.variantIndex &&
           a.servingType === b.servingType;
  }

  static isEmpty(servingId: ServingIdentifier | null | undefined): boolean {
    return servingId == null ||
           !servingId.provider ||
           !servingId.foodType ||
           !servingId.foodName ||
           !servingId.servingType;
  }

  static toUniqueString(servingId: ServingIdentifier | null | undefined): string {
    if (!servingId) return '';
    return `${servingId.provider}-${servingId.foodType}-${servingId.foodName}-${servingId.variantIndex}-${servingId.servingType}`;
  }
}