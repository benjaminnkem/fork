import { Controller, Get, Inject, Param } from "@nestjs/common";
import { SimulationsService } from "../simulations/simulations.service.js";

@Controller()
export class WalletsController {
  constructor(@Inject(SimulationsService) private readonly simulations: SimulationsService) {}

  @Get("wallets/:address/positions")
  positions(@Param("address") address: string) {
    return this.simulations.listPositions(address);
  }

  @Get("wallets/:address/risk")
  risk(@Param("address") address: string) {
    return this.simulations.listRisk(address);
  }

  @Get("wallets/:address/relevant-changes")
  relevant(@Param("address") address: string) {
    return this.simulations.relevantChanges(address);
  }
}
