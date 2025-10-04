import { PartnerService } from "../services/partner.service";
import { ROLE_SCOPES } from "../constants/scopes";

export async function getPartnerContext(userId: string): Promise<{ partnerId?: string; scopes?: string[] }> {
  const service = new PartnerService();
  const membership = await service.findByUserId(userId);
  if (!membership) return {};
  const scopes = ROLE_SCOPES[membership.member.role] || [];
  return { partnerId: membership.partner.id, scopes };
}
