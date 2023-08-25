"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
const meta_1 = __importDefault(require("../meta"));
const user_1 = __importDefault(require("../user"));
const plugins_1 = __importDefault(require("../plugins"));
const privileges_1 = __importDefault(require("../privileges"));
const socket_io_1 = __importDefault(require("../socket.io"));
module.exports = function (Messaging) {
    Messaging.editMessage = (uid, mid, roomId, content) => __awaiter(this, void 0, void 0, function* () {
        yield Messaging.checkContent(content);
        // Added the type string
        const raw = yield Messaging.getMessageField(mid, 'content');
        if (raw === content) {
            return;
        }
        // Added the type payloadInt
        const payload = yield plugins_1.default.hooks.fire('filter:messaging.edit', {
            content: content,
            edited: Date.now(),
        });
        //
        if (!String(payload.content).trim()) {
            throw new Error('[[error:invalid-chat-message]]');
        }
        yield Messaging.setMessageFields(mid, payload);
        // Propagate this change to users in the room
        const [uids, messages] = yield Promise.all([
            Messaging.getUidsInRoom(roomId, 0, -1),
            Messaging.getMessagesData([mid], uid, roomId, true),
        ]);
        uids.forEach((uid) => {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            socket_io_1.default.in(`uid_${uid}`).emit('event:chats.edit', {
                messages: messages,
            });
        });
    });
    const canEditDelete = (messageId, uid, type) => __awaiter(this, void 0, void 0, function* () {
        let durationConfig = '';
        if (type === 'edit') {
            durationConfig = 'chatEditDuration';
        }
        else if (type === 'delete') {
            durationConfig = 'chatDeleteDuration';
        }
        // Added type number
        const exists = yield Messaging.messageExists(messageId);
        if (!exists) {
            throw new Error('[[error:invalid-mid]]');
        }
        // Added string and number and string types
        const isAdminOrGlobalMod = yield user_1.default.isAdminOrGlobalMod(uid);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        if (meta_1.default.config.disableChat) {
            throw new Error('[[error:chat-disabled]]');
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        }
        else if (!isAdminOrGlobalMod && meta_1.default.config.disableChatMessageEditing) {
            throw new Error('[[error:chat-message-editing-disabled]]');
        }
        // Added the comment and UserDataType twice, with number casting
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        const userData = yield user_1.default.getUserFields(uid, ['banned']);
        if (userData.banned) {
            throw new Error('[[error:user-banned]]');
        }
        // Added the comment and boolean and umber casting
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const canChat = yield privileges_1.default.global.can('chat', uid);
        if (!canChat) {
            throw new Error('[[error:no-privileges]]');
        }
        // Added type number
        const messageData = yield Messaging.getMessageFields(messageId, ['fromuid', 'timestamp', 'system']);
        if (isAdminOrGlobalMod && !messageData.system) {
            return;
        }
        // Added type number twice
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const chatConfigDuration = meta_1.default.config[durationConfig];
        if (chatConfigDuration && Date.now() - messageData.timestamp > chatConfigDuration * 1000) {
            // Added the comment and number type
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            throw new Error(`[[error:chat-${type}-duration-expired, ${meta_1.default.config[durationConfig]}]]`);
        }
        if (messageData.fromuid === parseInt(uid, 10) && !messageData.system) {
            return;
        }
        throw new Error(`[[error:cant-${type}-chat-message]]`);
    });
    Messaging.canEdit = (messageId, uid) => __awaiter(this, void 0, void 0, function* () { return yield canEditDelete(messageId, uid, 'edit'); });
    Messaging.canDelete = (messageId, uid) => __awaiter(this, void 0, void 0, function* () { return yield canEditDelete(messageId, uid, 'delete'); });
};
