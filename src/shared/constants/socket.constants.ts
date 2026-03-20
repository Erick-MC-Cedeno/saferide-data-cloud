export const SocketRooms = {
  USER: (userId: string) => `user:${userId}`,
  CHAT: (userA: string, userB: string) => `chat:${[userA, userB].sort().join('-')}`,
  POST: (postId: string) => `post:${postId}`,
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
} as const;
