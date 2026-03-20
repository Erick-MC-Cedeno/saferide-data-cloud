import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { RidesGateway } from './rides.gateway';

@Injectable()
export class RidesListener {
  constructor(private readonly ridesGateway: RidesGateway) {}

  @OnEvent('ride.created')
  handleRideCreated(ride: any) {
    this.ridesGateway.emitRideRequested(ride);
  }

  @OnEvent('ride.accepted')
  handleRideAccepted(ride: any) {
    this.ridesGateway.emitRideAccepted(ride);
  }

  @OnEvent('ride.started')
  handleRideStarted(ride: any) {
    this.ridesGateway.emitRideStarted(ride);
  }

  @OnEvent('ride.completed')
  handleRideCompleted(ride: any) {
    this.ridesGateway.emitRideCompleted(ride);
  }

  @OnEvent('ride.cancelled')
  handleRideCancelled(ride: any) {
    this.ridesGateway.emitRideCancelled(ride);
  }
}
