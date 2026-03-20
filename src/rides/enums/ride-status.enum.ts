export enum RideStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  IN_PROGRESS = 'in-progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

export const RIDE_ACTIVE_STATUSES = [
  RideStatus.PENDING,
  RideStatus.ACCEPTED,
  RideStatus.IN_PROGRESS,
];
