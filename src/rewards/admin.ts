import * as plugins from '../plugins';
import * as db from '../database';
import * as utils from '../utils';


type RewardData = {
    id?: string | number;
    rewards: { [key: string]: string };
    condition: string;
    disabled?: boolean | string;
};

interface GetReturnType {
    // Random types
    active: boolean;
    conditions: string;
    conditionals: boolean;
    rewards: string;
}

type RewardsType = { [key: string]: string };

type SaveInput = RewardData[];

async function getActiveRewards(): Promise<RewardData[]> {
    // Nested function with types
    async function load(id: string | number): Promise<RewardData | null> {
        const [main, rewards] = await Promise.all([
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            db.getObject(`rewards:id:${id}`),
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            db.getObject(`rewards:id:${id}:rewards`),
        ]) as [RewardData | null, RewardsType | null];

        if (main) {
            main.disabled = main.disabled === 'true';
            main.rewards = rewards || {};
            return main;
        }
        return null;
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    const rewardsList: (string | number)[] = await db.getSetMembers('rewards:list') as string[];
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    const rewardData: (RewardData | null)[] = await Promise.all(rewardsList.map(id => load(id)));
    return rewardData.filter(Boolean);
}
export const rewards = {
    save: async function (data: SaveInput): Promise<RewardData[]> {
        const save = async (data: RewardData): Promise<RewardData> => {
            if (!Object.keys(data.rewards).length) {
                return data; // return data as it is if no rewards are present
            }
            const rewardsData = data.rewards;
            delete data.rewards;
            if (!parseInt(data.id as string, 10)) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
                data.id = await db.incrObjectField('global', 'rewards:id') as number;
            }
            await rewards.delete(data);
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            await db.setAdd('rewards:list', data.id as string);
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            await db.setObject(`rewards:id:${data.id}`, data);
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            await db.setObject(`rewards:id:${data.id}:rewards`, rewardsData);
            // CHECK THIS
            data.rewards = rewardsData; // add back the rewards to data
            return data;
        };
        // CHECK THIS
        const savedData = await Promise.all(data.map(save));
        await rewards.saveConditions(data);
        return savedData;
    },
    delete: async (data: RewardData): Promise<void> => {
        await Promise.all([
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            db.setRemove('rewards:list', data.id) as string[],
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            db.delete(`rewards:id:${data.id}`) as string[],
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            db.delete(`rewards:id:${data.id}:rewards`) as string[],
        ]);
    },

    get: async (): Promise<GetReturnType> => utils.promiseParallel({
        active: getActiveRewards(),
        conditions: plugins.hooks.fire('filter:rewards.conditions', []),
        conditionals: plugins.hooks.fire('filter:rewards.conditionals', []),
        rewards: plugins.hooks.fire('filter:rewards.rewards', []),
    }),
    saveConditions: async function (data: RewardData[]): Promise<void> {
        const rewardsPerCondition: { [key: string]: (string | number)[] } = {};
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        await db.delete('conditions:active') as string[];
        const conditions: string[] = [];

        data.forEach((reward) => {
            conditions.push(reward.condition);
            rewardsPerCondition[reward.condition] = rewardsPerCondition[reward.condition] || [];
            rewardsPerCondition[reward.condition].push(reward.id);
        });
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        await db.setAdd('conditions:active', conditions) as string[];
        await Promise.all(
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            Object.keys(rewardsPerCondition).map(c => db.setAdd(`condition:${c}:rewards`, rewardsPerCondition[c]) as string[])
        );
    },
};
export default rewards;
