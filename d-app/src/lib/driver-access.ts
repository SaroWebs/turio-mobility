type DriverAccount = {
  status?: string;
  is_approved?: boolean;
  is_active?: boolean;
};

export function canUseDriverServices(driver: DriverAccount | null | undefined): boolean {
  return driver?.status === 'active' && driver.is_approved === true && driver.is_active === true;
}
