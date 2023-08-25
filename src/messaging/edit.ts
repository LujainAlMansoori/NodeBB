import meta from '../meta';
import user from '../user';
import plugins from '../plugins';
import privileges from '../privileges';
import sockets from '../socket.io';

// Added  interfaces
interface MessageData {
  fromuid: number;
  timestamp: number;
  system: boolean;
}

interface Messaging {
  getMessageField(mid: number, field: string): Promise<string>;
  getMessageFields(mid: number, fields: string[]): Promise<MessageData>;
  editMessage(uid: number, mid: number, roomId: number, content: string): Promise<void>;
  canEdit(messageId: number, uid: number): Promise<void>;
  canDelete(messageId: number, uid: number): Promise<void>;
  checkContent(content: string): Promise<void>;
  setMessageFields(mid: number, payload: payloadInt): Promise<void>;
  getUidsInRoom(
    roomId: number,
    start: number,
    stop: number
  ): Promise<number[]>;
  getMessagesData(
    mids: number[],
    uid: number,
    roomId: number,
    flag: boolean
  ): Promise<string[]>;
  messageExists(mid: number): Promise<boolean>;
}

interface payloadInt {
    content: string;
    edited: string;
}

interface UserDataType {
    banned: boolean;
}

export = function (Messaging: Messaging) {
    Messaging.editMessage = async (uid, mid, roomId, content) => {
        await Messaging.checkContent(content);
        // Added the type string
        const raw: string = await Messaging.getMessageField(mid, 'content');
        if (raw === content) {
            return;
        }

        // Added the type payloadInt
        const payload = await plugins.hooks.fire('filter:messaging.edit', {
            content: content,
            edited: Date.now(),
        }) as payloadInt;

        //

        if (!String(payload.content).trim()) {
            throw new Error('[[error:invalid-chat-message]]');
        }
        await Messaging.setMessageFields(mid, payload);

        // Propagate this change to users in the room
        const [uids, messages] = await Promise.all([
            Messaging.getUidsInRoom(roomId, 0, -1),
            Messaging.getMessagesData([mid], uid, roomId, true),
        ]);

        uids.forEach((uid) => {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            sockets.in(`uid_${uid}`).emit('event:chats.edit', {
                messages: messages,
            });
        });
    };
    const canEditDelete = async (messageId, uid, type) => {
        let durationConfig = '';
        if (type === 'edit') {
            durationConfig = 'chatEditDuration';
        } else if (type === 'delete') {
            durationConfig = 'chatDeleteDuration';
        }
        // Added type number
        const exists = await Messaging.messageExists(messageId as number);
        if (!exists) {
            throw new Error('[[error:invalid-mid]]');
        }
        // Added string and number and string types
        const isAdminOrGlobalMod: string = await user.isAdminOrGlobalMod(uid as number) as string;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        if (meta.config.disableChat) {
            throw new Error('[[error:chat-disabled]]');
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        } else if (!isAdminOrGlobalMod && meta.config.disableChatMessageEditing) {
            throw new Error('[[error:chat-message-editing-disabled]]');
        }
        // Added the comment and UserDataType twice, with number casting
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        const userData: UserDataType = await user.getUserFields(uid as number, ['banned']) as UserDataType;
        if (userData.banned) {
            throw new Error('[[error:user-banned]]');
        }
        // Added the comment and boolean and umber casting
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const canChat: boolean = await privileges.global.can('chat', uid as number);
        if (!canChat) {
            throw new Error('[[error:no-privileges]]');
        }

        const messageData = await Messaging.getMessageFields(messageId, ['fromuid', 'timestamp', 'system']);
        if (isAdminOrGlobalMod && !messageData.system) {
            return;
        }

        const chatConfigDuration = meta.config[durationConfig];
        if (chatConfigDuration && Date.now() - messageData.timestamp > chatConfigDuration * 1000) {
            throw new Error(`[[error:chat-${type}-duration-expired, ${meta.config[durationConfig]}]]`);
        }

        if (messageData.fromuid === parseInt(uid, 10) && !messageData.system) {
            return;
        }

        throw new Error(`[[error:cant-${type}-chat-message]]`);
    };

    Messaging.canEdit = async (messageId, uid) => await canEditDelete(messageId, uid, 'edit');
    Messaging.canDelete = async (messageId, uid) => await canEditDelete(messageId, uid, 'delete');
};
