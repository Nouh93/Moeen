import { Controller, Get, Param, UseGuards } from "@nestjs/common";
import { AuthUser, CurrentUser, JwtAuthGuard } from "../auth/jwt.guard";
import { StoresService } from "../stores/stores.service";
import { NotificationsService } from "./notifications.service";

@UseGuards(JwtAuthGuard)
@Controller("stores/:storeId/notifications")
export class NotificationsController {
  constructor(
    private notifications: NotificationsService,
    private stores: StoresService,
  ) {}

  @Get()
  async list(@CurrentUser() u: AuthUser, @Param("storeId") storeId: string) {
    await this.stores.ownedByOrThrow(storeId, u.sub);
    return this.notifications.listForStore(storeId);
  }
}
