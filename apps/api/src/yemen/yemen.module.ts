import { Module } from "@nestjs/common";
import { YemenController } from "./yemen.controller";

@Module({ controllers: [YemenController] })
export class YemenModule {}
