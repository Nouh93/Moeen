import { Module } from "@nestjs/common";
import { HealthController, YemenController } from "./yemen.controller";

@Module({ controllers: [YemenController, HealthController] })
export class YemenModule {}
