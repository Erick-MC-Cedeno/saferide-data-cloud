export const SocketRooms = {
  USER: (userId: string) => `user:${userId}`,
  CHAT: (userA: string, userB: string) => `chat:${[userA, userB].sort().join('-')}`,
  POST: (postId: string) => `post:${postId}`,
  RIDE: (rideId: string) => `ride:${rideId}`,
  DRIVERS_ONLINE: 'drivers:online',
} as const;

export const SocketEvents = {
  RECEIVE_MESSAGE: 'receiveMessage',
  MESSAGE_SENT: 'messageSent',
  MESSAGE_UPDATED: 'messageUpdated',
  POST_CREATED: 'postCreated',
  POST_UPDATED: 'postUpdated',
  POST_DELETED: 'postDeleted',
  COMMENT_CREATED: 'commentCreated',
  COMMENT_UPDATED: 'commentUpdated',
  COMMENT_DELETED: 'commentDeleted',
  ERROR: 'error',
  // Ride lifecycle events
  RIDE_NEW_REQUEST: 'ride:new_request',
  RIDE_REQUEST_FOR_DRIVER: 'ride:request_for_driver',
  RIDE_ACCEPTED: 'ride:accepted',
  RIDE_STARTED: 'ride:started',
  RIDE_COMPLETED: 'ride:completed',
  RIDE_CANCELLED: 'ride:cancelled',
  RIDE_RATED: 'ride:rated',
  RIDE_DRIVER_LOCATION: 'driver:location',
  DRIVER_PROFILE_INCOMPLETE: 'driver:profile_incomplete',
} as const;
