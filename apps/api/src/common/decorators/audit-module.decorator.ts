import { SetMetadata } from '@nestjs/common';

export const AUDIT_MODULE_KEY = 'easytrip:auditModule';

/** Names the module a route belongs to, so the audit trail reads in product terms. */
export const AuditModule = (module: string) => SetMetadata(AUDIT_MODULE_KEY, module);
