import { describe, it, expect, vi } from 'vitest';

vi.mock('./session', () => ({ PORTAL_URL: 'http://localhost:8000' }));

import { canSwitchSystem, switchSystemUrl } from './switchSystem';

// covers: spec 0007 AC-8, AC-9, AC-14
describe('Switch system', () => {
  it('shows with two or more systems, and an older answer counts as none', () => {
    expect(canSwitchSystem(null)).toBe(false);
    expect(canSwitchSystem({ systems: [], role: 'CUSTOMER_SUPPORT' })).toBe(false);
    expect(canSwitchSystem({ systems: ['BMS'], role: 'OPERATIONS' })).toBe(false);
    expect(canSwitchSystem({ systems: ['VMMS', 'BMS'], role: 'CUSTOMER_SUPPORT' })).toBe(true);
    expect(canSwitchSystem({ systems: undefined as unknown as string[], role: 'CUSTOMER_SUPPORT' })).toBe(false);
  });

  it('shows for a one system BMS Admin, whose launcher holds the Admin card (AC-14)', () => {
    expect(canSwitchSystem({ systems: ['BMS'], role: 'ADMIN' })).toBe(true);
  });

  it('opens the portal launcher with from=BMS', () => {
    expect(switchSystemUrl()).toBe('http://localhost:8000/?from=BMS');
    expect(switchSystemUrl('https://portal.test/')).toBe('https://portal.test/?from=BMS');
  });
});
