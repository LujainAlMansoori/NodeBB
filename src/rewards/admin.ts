import * as plugins from '../plugins';
import * as db from '../database';
import * as utils from '../utils';

const rewards = module.exports;

type RewardData = {
    id?: string | number;
    rewards: { [key: string]: string };
    condition: string;
    disabled?: boolean | string;
};

type RewardsType = { [key: string]: string };
type SaveInput = RewardData[];

async function getActiveRewards(): Promise<RewardData[]> {
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
//


rewards.save = async function (data) {
    async function save(data) {
        if (!Object.keys(data.rewards).length) {
            return;
        }
        const rewardsData = data.rewards;
        delete data.rewards;
        if (!parseInt(data.id, 10)) {
            data.id = await db.incrObjectField('global', 'rewards:id');
        }
        await rewards.delete(data);
        await db.setAdd('rewards:list', data.id);
        await db.setObject(`rewards:id:${data.id}`, data);
        await db.setObject(`rewards:id:${data.id}:rewards`, rewardsData);
    }

    await Promise.all(data.map(data => save(data)));
    await saveConditions(data);
    return data;
};

rewards.delete = async function (data) {
    await Promise.all([
        db.setRemove('rewards:list', data.id),
        db.delete(`rewards:id:${data.id}`),
        db.delete(`rewards:id:${data.id}:rewards`),
    ]);
};

rewards.get = async function () {
    return await utils.promiseParallel({
        active: getActiveRewards(),
        conditions: plugins.hooks.fire('filter:rewards.conditions', []),
        conditionals: plugins.hooks.fire('filter:rewards.conditionals', []),
        rewards: plugins.hooks.fire('filter:rewards.rewards', []),
    });
};

async function saveConditions(data) {
    const rewardsPerCondition = {};
    await db.delete('conditions:active');
    const conditions = [];

    data.forEach((reward) => {
        conditions.push(reward.condition);
        rewardsPerCondition[reward.condition] = rewardsPerCondition[reward.condition] || [];
        rewardsPerCondition[reward.condition].push(reward.id);
    });

    await db.setAdd('conditions:active', conditions);

    await Promise.all(Object.keys(rewardsPerCondition).map(c => db.setAdd(`condition:${c}:rewards`, rewardsPerCondition[c])));
}



require('../promisify')(rewards);