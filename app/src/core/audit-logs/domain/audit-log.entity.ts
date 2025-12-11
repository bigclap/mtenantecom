export class AuditLog {
  constructor(
    public readonly id: string,
    public readonly tenantId: string,
    public readonly eventType: string,
    public readonly payload: any,
    public readonly hash: string,
    public readonly prevHash: string | null,
    public readonly createdAt: Date,
  ) {}
}
