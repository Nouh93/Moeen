import { IsIn, IsNotEmpty, IsNumberString, IsOptional, IsString } from "class-validator";

const SOURCES = [
  "MEPS_SETTLEMENT",
  "AGGREGATOR",
  "WALLET_API",
  "MEPS_CARD",
  "BANK_TRANSFER",
  "MANUAL_RECEIPT",
  "PREPAID_BALANCE",
] as const;

export class PaymentWebhookDto {
  @IsString()
  @IsNotEmpty()
  externalRef!: string;

  @IsIn(SOURCES)
  source!: (typeof SOURCES)[number];

  // نصّ رقمي للحفاظ على الدقّة (الوحدة الصغرى).
  @IsNumberString()
  amountMinor!: string;

  @IsOptional()
  @IsString()
  reference?: string;
}

export class IssueInvoiceDto {
  @IsNumberString()
  priceMinor!: string;
}
