import { PassportSerializer } from "@nestjs/passport";
import { Injectable } from "@nestjs/common";
import { UserService } from "../../user/user.service";

@Injectable()
export class SessionSerializer extends PassportSerializer {
    constructor(private readonly userService: UserService) {
        super();
    }

    serializeUser(user: any, done: (err: Error | null, user: any) => void): any {
        // store only the user id in the session to keep size small and secure
        const id = (user && (user._id || user.id)) ? (user._id || user.id).toString() : user;
        done(null, id);
    }

    async deserializeUser(payload: any, done: (err: Error | null, user: any) => void): Promise<any> {
        try {
            const user = await this.userService.getUserById(payload as string);
            done(null, user || null);
        } catch (err) {
            done(err as Error, null);
        }
    }
}
