import type * as AccessControlModule from '../modules/security/accessControl.js';
import type aiCommandRouter from '../modules/ai/aiCommandRouter.js';
import type * as CacheModule from '../modules/infrastructure/cache.js';
import type * as ConversationModule from '../modules/ai/conversation.js';
import type * as CsrfModule from '../modules/security/csrf.js';
import type * as EncryptionModule from '../modules/security/encryption.js';
import type * as ErrorsModule from '../services/errors.js';
import type { HistoryService } from '../modules/ai/history.js';
import type * as JsonOptimizationModule from '../services/jsonOptimization.js';
import type * as InternalAssistantEngineModule from '../modules/ai/internalAssistantEngine.js';
import type * as LocalResponderModule from '../modules/ai/localResponder.js';
import type * as NluModule from '../modules/ai/nlu.js';
import type * as PathSecurityModule from '../services/pathSecurity.js';
import type { PlannerService } from '../modules/ai/planner.js';
import type * as PrismaGuardsModule from '../modules/database/prismaGuards.js';
import type { ProgressionService } from '../modules/training/progression.js';
import type { RequestValidationService } from '../services/requestValidation.js';
import type * as SensitiveEncryptionModule from '../services/sensitiveDataEncryption.js';
import type { SessionService } from '../services/sessionService.js';
import type * as StaticPlanModule from '../modules/ai/staticPlan.js';
import type * as StringSanitizationModule from '../services/stringSanitization.js';
import type { DatabaseService } from '../modules/integrations/supabase.js';
import type * as TokenServiceModule from '../modules/profile/tokenService.js';
import type * as XssProtectionModule from '../modules/security/xssProtection.js';

export interface AccessControlService
  extends Pick<
    typeof AccessControlModule,
    'assertProfileOwnership' | 'ensureOwnedByProfile' | 'isAccessDeniedError'
  > { }

export interface AiCommandRouterService extends Pick<typeof aiCommandRouter, 'interpret'> { }

export interface CacheService
  extends Pick<
    typeof CacheModule,
    'cacheGet' | 'cacheSet' | 'cacheDel' | 'cacheRemember' | 'closeCache'
  > { }

export interface ConversationServiceContract extends Pick<typeof ConversationModule.default, 'generateReply'> { }

export interface CsrfService
  extends Pick<
    typeof CsrfModule,
    | 'createCsrfToken'
    | 'verifyCsrfToken'
    | 'shouldRefreshCsrfToken'
    | 'issueCsrfToken'
    | 'resolveCookieOptions'
    | 'getCsrfTtlMs'
    | 'getCsrfRefreshThresholdMs'
  > { }

export interface EncryptionService
  extends Pick<
    typeof EncryptionModule,
    'encryptToBase64' | 'decryptFromBase64' | 'ensureEncryptionConfigured' | 'isEncryptionConfigured'
  > { }

export interface JsonOptimizationService
  extends Pick<typeof JsonOptimizationModule, 'applyJsonOptimization' | 'optimizeJsonValue'> { }

export interface ErrorHandlingService
  extends Pick<typeof ErrorsModule, 'isAppError' | 'normalizeToAppError' | 'formatErrorResponse'> { }

export interface HistoryServiceContract
  extends Pick<HistoryService, 'loadAssistantHistory' | 'persistAssistantTurn'> { }

export interface InternalAssistantEngineService
  extends Pick<
    typeof InternalAssistantEngineModule,
    | 'initializeDb'
    | 'interpretCommand'
    | 'generateTrainerReply'
    | 'generateGeneralReply'
    | 'generateTrainingPlan'
    | 'analyzeTrainingReport'
    | 'buildMotivationMessage'
    | 'buildPlanHint'
    | 'buildFeedbackMessage'
    | 'getEngineCatalog'
    | 'resolveEngine'
  > { }

type LocalResponderShape = typeof LocalResponderModule.default;

export interface LocalResponderService extends Pick<LocalResponderShape, 'buildLocalReply'> { }

export interface NluService extends Pick<typeof NluModule, 'detectIntent'> { }

export interface PathSecurityService
  extends Pick<
    typeof PathSecurityModule,
    'resolveSafePath' | 'ensurePathWithin' | 'isPathWithin' | 'createSafeFileAccess'
  > { }

export interface PlannerServiceContract
  extends Pick<PlannerService, 'generateTrainingPlan' | 'analyzeTrainingReport' | 'generateMotivationalMessage'> { }

export interface PrismaGuardService
  extends Pick<typeof PrismaGuardsModule, 'hardenPrismaAgainstSqlInjection'> { }

export interface ProgressionServiceContract
  extends Pick<
    ProgressionService,
    'analyzeExercise' | 'calculateNextLevel' | 'saveProgressionDecision' | 'getExerciseHistory' | 'calculateProgressTrend'
  > { }

export interface RequestValidationServiceContract {
  validate: typeof RequestValidationService.validate;
}

export interface SensitiveDataEncryptionService extends Pick<typeof SensitiveEncryptionModule, 'applySensitiveDataEncryption'> { }

export interface SessionServiceContract
  extends Pick<
    SessionService,
    'getSessionForDay' | 'getWeekSessions' | 'getSessionById' | 'saveSession' | 'updateSession' | 'deleteSession'
  > { }

export interface StaticPlanService
  extends Pick<typeof StaticPlanModule, 'buildDefaultWeekPlan' | 'getProgressionOverview' | 'buildProgressionCatalog'> { }

export interface StringSanitizationService
  extends Pick<typeof StringSanitizationModule, 'sanitizeStringValue' | 'applyStringSanitization'> { }

export interface SupabaseDatabaseService extends DatabaseService { }

export interface TokenServiceContract
  extends Pick<
    typeof TokenServiceModule,
    'issueAuthToken' | 'revokeTokenId' | 'revokeAuthToken' | 'validateAuthToken' | 'getRevokedTokenCount'
  > { }

export interface XssProtectionService extends Pick<typeof XssProtectionModule, 'applyXssProtection'> { }
