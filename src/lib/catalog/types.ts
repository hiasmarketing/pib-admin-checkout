export type TurmaStatus = "draft" | "active" | "inactive" | "archived";
export type AdminRole = "admin" | "operator";
export type Currency = "brl" | "usd";
export type InstallmentCount = 1 | 2 | 3 | 6 | 12;
export type CouponDiscountType = "percent" | "fixed_amount";

export interface TurmaDTO {
  id: string;
  name: string;
  slug: string;
  startsAt: string | null;
  endsAt: string | null;
  location: string | null;
  status: TurmaStatus;
  externalMetadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface TurmaInput {
  name: string;
  slug: string;
  startsAt?: string | null;
  endsAt?: string | null;
  location?: string | null;
  status: TurmaStatus;
  externalMetadata?: Record<string, unknown>;
}

export interface ProductDTO {
  id: string;
  turmaId: string;
  name: string;
  slug: string;
  description: string | null;
  unitAmountCents: number;
  currency: Currency;
  maxQuantity: number;
  active: boolean;
  isDefault: boolean;
  installmentOptions: InstallmentCount[];
  paymentMethods: PaymentMethodType[];
  installmentRates: Record<string, number>;
  offerMetadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface ProductInput {
  turmaId: string;
  name: string;
  slug: string;
  description?: string | null;
  unitAmountCents: number;
  currency: Currency;
  maxQuantity: number;
  active: boolean;
  isDefault: boolean;
  installmentOptions: InstallmentCount[];
  paymentMethods: PaymentMethodType[];
  installmentRates?: Record<string, number>;
  offerMetadata?: Record<string, unknown>;
}

export interface CouponScopeDTO {
  turmaIds: string[];
  productIds: string[];
}

export interface CouponDTO {
  id: string;
  code: string;
  name: string;
  description: string | null;
  discountType: CouponDiscountType;
  discountValue: number;
  currency: Currency;
  active: boolean;
  startsAt: string | null;
  endsAt: string | null;
  maxRedemptions: number | null;
  redeemedCount: number;
  minimumSubtotalCents: number | null;
  maxDiscountCents: number | null;
  turmaIds: string[];
  productIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CouponInput {
  code: string;
  name: string;
  description?: string | null;
  discountType: CouponDiscountType;
  discountValue: number;
  currency: Currency;
  active: boolean;
  startsAt?: string | null;
  endsAt?: string | null;
  maxRedemptions?: number | null;
  minimumSubtotalCents?: number | null;
  maxDiscountCents?: number | null;
  turmaIds: string[];
  productIds: string[];
  metadata?: Record<string, unknown>;
}

export interface SellerDTO {
  id: string;
  sellerId: string | null;
  slug: string;
  name: string;
  email: string | null;
  phone: string | null;
  active: boolean;
  externalMetadata: Record<string, unknown>;
  turmaIds: string[];
  productIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface SellerInput {
  sellerId?: string | null;
  slug: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  active: boolean;
  turmaIds: string[];
  productIds: string[];
  externalMetadata?: Record<string, unknown>;
}

export type PaymentMethodType = "card" | "pix" | "klarna" | "afterpay_clearpay";

export interface PublicCheckoutProductOption {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  unitAmountCents: number;
  currency: Currency;
  maxQuantity: number;
  installmentOptions: InstallmentCount[];
  isDefault: boolean;
  paymentMethods: PaymentMethodType[];
  installmentRates: Record<string, number>;
}

export interface PublicCheckoutTurmaOption {
  id: string;
  slug: string;
  name: string;
  startsAt: string | null;
  endsAt: string | null;
  location: string | null;
  products: PublicCheckoutProductOption[];
}

export interface CatalogSelection {
  turmaId?: string;
  turmaSlug?: string;
  productId?: string;
  productSlug?: string;
  sellerId?: string;
  sellerSlug?: string;
}

export interface ResolvedCatalogProduct {
  turma: {
    id: string;
    name: string;
    slug: string;
    startsAt: string | null;
    status: TurmaStatus;
  };
  product: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    unitAmountCents: number;
    currency: Currency;
    maxQuantity: number;
    active: boolean;
    installmentOptions: InstallmentCount[];
    paymentMethods: PaymentMethodType[];
    installmentRates: Record<string, number>;
  };
}

export interface AppliedCoupon {
  id: string;
  code: string;
  name: string;
  discountType: CouponDiscountType;
  discountValue: number;
  discountAmountCents: number;
}

export interface ResolvedSeller {
  id: string;
  sellerId: string | null;
  slug: string;
  name: string;
  active: boolean;
}
