import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from "@nestjs/common";
import {
  CurrencyMismatchError,
  InsufficientFundsError,
  InvalidAmountError,
  LedgerError,
  UnbalancedEntryError,
  UnknownAccountError,
} from "@moeen/ledger";
import type { Response } from "express";

/**
 * يحوّل أخطاء النطاق المالي إلى استجابات HTTP واضحة بدل 500 صامتة.
 */
@Catch(LedgerError)
export class LedgerExceptionFilter implements ExceptionFilter {
  catch(error: LedgerError, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const status = this.statusFor(error);
    response.status(status).json({
      error: error.name,
      message: error.message,
      ...(error instanceof InsufficientFundsError
        ? { accountId: error.accountId, available: error.available, requested: error.requested }
        : {}),
    });
  }

  private statusFor(error: LedgerError): number {
    if (error instanceof InsufficientFundsError) return HttpStatus.CONFLICT; // 409
    if (error instanceof UnknownAccountError) return HttpStatus.NOT_FOUND; // 404
    if (
      error instanceof UnbalancedEntryError ||
      error instanceof CurrencyMismatchError ||
      error instanceof InvalidAmountError
    ) {
      return HttpStatus.UNPROCESSABLE_ENTITY; // 422
    }
    return HttpStatus.BAD_REQUEST; // 400
  }
}
