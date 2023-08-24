"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const plugins = __importStar(require("../plugins"));
const db = __importStar(require("../database"));
const utils = __importStar(require("../utils"));
const rewards = module.exports;
function getActiveRewards() {
    return __awaiter(this, void 0, void 0, function* () {
        function load(id) {
            return __awaiter(this, void 0, void 0, function* () {
                const [main, rewards] = yield Promise.all([
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
                    db.getObject(`rewards:id:${id}`),
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
                    db.getObject(`rewards:id:${id}:rewards`),
                ]);
                if (main) {
                    main.disabled = main.disabled === 'true';
                    main.rewards = rewards || {};
                    return main;
                }
                return null;
            });
        }
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const rewardsList = yield db.getSetMembers('rewards:list');
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const rewardData = yield Promise.all(rewardsList.map(id => load(id)));
        return rewardData.filter(Boolean);
    });
}
//
rewards.save = function (data) {
    return __awaiter(this, void 0, void 0, function* () {
        const save = (data) => __awaiter(this, void 0, void 0, function* () {
            if (!Object.keys(data.rewards).length) {
                return; // return data as it is if no rewards are present
            }
            const rewardsData = data.rewards;
            delete data.rewards;
            if (!parseInt(data.id, 10)) {
                data.id = (yield db.incrObjectField('global', 'rewards:id'));
            }
            yield rewards.delete(data);
            yield db.setAdd('rewards:list', data.id);
            yield db.setObject(`rewards:id:${data.id}`, data);
            yield db.setObject(`rewards:id:${data.id}:rewards`, rewardsData);
            // data.rewards = rewardsData; // add back the rewards to data
            // return data;
        });
        // const savedData = await Promise.all(data.map(save));
        // await rewards.saveConditions(data);
        // return savedData;
        yield Promise.all(data.map(data => save(data)));
        yield saveConditions(data);
        return data;
    });
};
rewards.delete = function (data) {
    return __awaiter(this, void 0, void 0, function* () {
        yield Promise.all([
            db.setRemove('rewards:list', data.id),
            db.delete(`rewards:id:${data.id}`),
            db.delete(`rewards:id:${data.id}:rewards`),
        ]);
    });
};
rewards.get = function () {
    return __awaiter(this, void 0, void 0, function* () {
        return yield utils.promiseParallel({
            active: getActiveRewards(),
            conditions: plugins.hooks.fire('filter:rewards.conditions', []),
            conditionals: plugins.hooks.fire('filter:rewards.conditionals', []),
            rewards: plugins.hooks.fire('filter:rewards.rewards', []),
        });
    });
};
function saveConditions(data) {
    return __awaiter(this, void 0, void 0, function* () {
        const rewardsPerCondition = {};
        yield db.delete('conditions:active');
        const conditions = [];
        data.forEach((reward) => {
            conditions.push(reward.condition);
            rewardsPerCondition[reward.condition] = rewardsPerCondition[reward.condition] || [];
            rewardsPerCondition[reward.condition].push(reward.id);
        });
        yield db.setAdd('conditions:active', conditions);
        yield Promise.all(Object.keys(rewardsPerCondition).map(c => db.setAdd(`condition:${c}:rewards`, rewardsPerCondition[c])));
    });
}
require('../promisify')(rewards);
