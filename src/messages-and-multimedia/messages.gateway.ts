import { Logger } from '@nestjs/common';
import { SubscribeMessage, WebSocketGateway, WebSocketServer, OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { OnEvent } from '@nestjs/event-emitter';
import type { MessageCreatedEvent } from './events/message-created.event';
import { Server, Socket } from 'socket.io';
import { RedisService } from '../shared/redis';
import type { SessionData } from '../shared/interfaces';
import { SocketRooms, SocketEvents } from '../shared/constants';

const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['http://localhost:3000'];
const SOCKET_RATE_LIMIT = 10;
const RATE_LIMIT_WINDOW = 5000;

@WebSocketGateway({ 
  namespace: '/messages', 
  cors: { origin: allowedOrigins, credentials: true },
  pingTimeout: 60000,
  pingInterval: 25000,
})
export class MessagesGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private logger = new Logger('MessagesGateway');
  private readonly rateLimitMap = new Map<string, { count: number; resetAt: number }>();

  private get redisStore() {
    return this.redisService.getStore();
  }

  constructor(private readonly redisService: RedisService) {}

  private parseCookies(cookieHeader: string | undefined): Record<string, string> {
    const rc = cookieHeader || '';
    return rc.split(';').map(c => c.trim()).filter(Boolean).reduce((acc, item) => {
      const idx = item.indexOf('=');
      if (idx > -1) {
        const k = item.substring(0, idx);
        const v = item.substring(idx + 1);
        acc[k] = decodeURIComponent(v);
      }
      return acc;
    }, {});
  }

  private async validateSession(sid: string): Promise<SessionData | null> {
    const sess = await new Promise<SessionData | null>((resolve, reject) => {
      this.redisStore.get(sid, (err: any, sess: SessionData) => {
        if (err) return reject(err);
        resolve(sess);
      });
    });

    if (!sess) return null;

    if (sess.cookie?.expires) {
      const expires = new Date(sess.cookie.expires as string);
      if (expires < new Date()) {
        return null;
      }
    }

    return sess;
  }

  async handleConnection(client: Socket) {
    try {
      const cookies = this.parseCookies(client.handshake.headers.cookie);
      const rawSid = cookies['connect.sid'] || cookies['sid'] || null;
      if (!rawSid) {
        this.logger.warn(`No session cookie present for socket ${client.id}`);
        void client.emit('error', { message: 'Unauthorized' });
        client.disconnect();
        return;
      }

      let sid = rawSid;
      if (sid.startsWith('s:')) {
        sid = sid.slice(2).split('.')[0];
      }

      const sess = await this.validateSession(sid);
      if (!sess) {
        this.logger.warn(`Session not found or expired for socket ${client.id}`);
        void client.emit('error', { message: 'Unauthorized' });
        client.disconnect();
        return;
      }

      const passportUser = sess.passport?.user || null;
      if (!passportUser) {
        this.logger.warn(`No passport user in session for socket ${client.id}`);
        void client.emit('error', { message: 'Unauthorized' });
        client.disconnect();
        return;
      }

      client.data.user = passportUser;
      const userId = passportUser._id.toString();
      client.join(SocketRooms.USER(userId));
      this.logger.log(`Socket ${client.id} authenticated and joined ${SocketRooms.USER(userId)}`);
    } catch (e) {
      this.logger.error(`Error during socket auth for ${client.id}: ${e}`);
      void client.emit('error', { message: 'Unauthorized' });
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.rateLimitMap.delete(client.id);
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  private checkSocketRateLimit(clientId: string): boolean {
    const now = Date.now();
    const record = this.rateLimitMap.get(clientId);
    
    if (!record || now > record.resetAt) {
      if (record) this.rateLimitMap.delete(clientId);
      this.rateLimitMap.set(clientId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
      return true;
    }
    
    if (record.count >= SOCKET_RATE_LIMIT) return false;
    record.count++;
    return true;
  }

  @SubscribeMessage('joinChat')
  handleJoinChat(client: Socket, payload: { otherUserId: string }) {
    if (!this.checkSocketRateLimit(client.id)) {
      void client.emit('error', { message: 'Rate limit exceeded' });
      return;
    }

    if (!client.data?.user || !client.data.user._id) {
      void client.emit('error', { message: 'Unauthorized' });
      return;
    }

    const senderId = client.data.user._id.toString();
    if (!senderId) {
      void client.emit('error', { message: 'Unauthorized' });
      return;
    }

    if (!payload?.otherUserId) {
      void client.emit('error', { message: 'Missing otherUserId' });
      return;
    }

    const room = SocketRooms.CHAT(senderId, payload.otherUserId);
    client.join(room);
    this.logger.log(`Socket ${client.id} joined chat room ${room}`);
  }
}
