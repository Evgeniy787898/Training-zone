import { Prisma } from '@prisma/client';

const connectivityErrorCodes = new Set([
  'P1000',
  'P1001',
  'P1002',
  'P1003',
  'P1008',
  'P1010',
  'P1011',
  'P1017',
]);

const transientKnownRequestErrorCodes = new Set([
  'P1000',
  'P1001',
  'P1002',
  'P1003',
  'P1008',
  'P1010',
  'P1011',
  'P1012',
  'P1013',
  'P1017',
  'P2028',
  'P2029',
  'P2034',
]);

const transientMessageIndicators = [
  'timeout',
  'timed out',
  'socket hang up',
  'read ECONNRESET',
  'write ECONNRESET',
  'database is locked',
  'could not serialize access due to concurrent update',
  'deadlock detected',
  'connection closed',
  'connection terminated',
  'restart transaction',
];

const extractErrorCode = (error: unknown) => {
  if (typeof (error as any)?.code === 'string') {
    return (error as any).code as string;
  }
  if (typeof (error as any)?.meta?.code === 'string') {
    return (error as any).meta.code as string;
  }
  return undefined;
};

const extractMessage = (error: unknown) => {
  if (typeof (error as any)?.message === 'string') {
    return (error as any).message.toLowerCase();
  }
  return '';
};

export const isPrismaConnectivityError = (error: unknown) => {
  if (!error) {
    return false;
  }
  if (error instanceof Prisma.PrismaClientInitializationError) {
    return true;
  }
  if (error instanceof Prisma.PrismaClientRustPanicError) {
    return true;
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return connectivityErrorCodes.has(error.code);
  }
  const code = extractErrorCode(error);
  if (code && connectivityErrorCodes.has(code)) {
    return true;
  }
  const message = extractMessage(error);
  if (message.includes('connect') || message.includes('timeout')) {
    return true;
  }
  return false;
};

export const isPrismaTransientError = (error: unknown) => {
  if (!error) {
    return false;
  }
  if (isPrismaConnectivityError(error)) {
    return true;
  }
  if (error instanceof Prisma.PrismaClientUnknownRequestError) {
    return true;
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return transientKnownRequestErrorCodes.has(error.code);
  }
  const code = extractErrorCode(error);
  if (code && transientKnownRequestErrorCodes.has(code)) {
    return true;
  }
  const message = extractMessage(error);
  if (!message) {
    return false;
  }
  return transientMessageIndicators.some((indicator) => message.includes(indicator));
};
