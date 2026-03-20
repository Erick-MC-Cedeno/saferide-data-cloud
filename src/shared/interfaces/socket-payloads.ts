export interface MessagePayload {
  _id: string;
  content: string;
  type: string;
  sender: string;
  receiver: string;
  multimediaId?: string;
  multimediaUrl?: string;
  thumbnailUrl?: string;
  status: 'sent' | 'delivered' | 'read';
  createdAt: Date;
  updatedAt: Date;
}

export interface PostPayload {
  _id: string;
  description?: string;
  type: string;
  author: string;
  authorFirstName?: string;
  authorLastName?: string;
  multimediaId?: string;
  multimediaUrl?: string;
  thumbnailUrl?: string;
  likesCount?: number;
  commentsCount?: number;
  shares?: number;
  views?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CommentPayload {
  _id: string;
  content: string;
  author: string;
  authorFirstName?: string;
  authorLastName?: string;
  post: string;
  postAuthorId?: string;
  parent?: string;
  likes?: string[];
  likesCount?: number;
  createdAt: Date;
  updatedAt?: Date;
}

export interface SessionData {
  passport?: {
    user?: {
      _id: string;
      [key: string]: unknown;
    };
  };
  cookie?: {
    expires?: Date | string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}
