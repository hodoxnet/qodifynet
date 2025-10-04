export const SCOPES = {
  SETUP_RUN: "setup.run",
  CUSTOMER_READ_OWN: "customer.read:own",
  CUSTOMER_CREATE_OWN: "customer.create:own",
  CREDIT_VIEW_OWN: "credit.view:own",
} as const;

export const ROLE_SCOPES: Record<string, string[]> = {
  PARTNER_ADMIN: [
    SCOPES.SETUP_RUN,
    SCOPES.CUSTOMER_READ_OWN,
    SCOPES.CUSTOMER_CREATE_OWN,
    SCOPES.CREDIT_VIEW_OWN,
  ],
  PARTNER_INSTALLER: [
    SCOPES.SETUP_RUN,
    SCOPES.CUSTOMER_READ_OWN,
  ],
};

