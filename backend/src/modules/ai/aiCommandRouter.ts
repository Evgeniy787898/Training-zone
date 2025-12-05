// TZONA V2 - AI Command Router Service
// Ported from V1 aiCommandRouter.js
import { interpretCommand } from './internalAssistantEngine.js';

export class AiCommandRouter {
    async interpret({ profile, message, history = [] }: {
        profile?: any;
        message?: string;
        history?: any[];
    }) {
        return interpretCommand({ profile, message, history });
    }
}

export default new AiCommandRouter();

