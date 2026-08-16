import { Controller, Get, Inject, Param } from "@nestjs/common";
import { SimulationsService } from "../simulations/simulations.service.js";

@Controller()
export class ChangesController {
  constructor(@Inject(SimulationsService) private readonly simulations: SimulationsService) {}

  @Get("changes")
  list() {
    return this.simulations.listChanges();
  }

  @Get("changes/:id")
  get(@Param("id") id: string) {
    return this.simulations.getChange(id);
  }
}
