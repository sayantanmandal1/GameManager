import { GuestLoginDto } from './guest-login.dto';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';

describe('GuestLoginDto', () => {
  async function validateDto(data: Record<string, unknown>) {
    const dto = plainToInstance(GuestLoginDto, data);
    return validate(dto);
  }

  it('should accept valid username', async () => {
    const errors = await validateDto({ username: 'TestPlayer' });
    expect(errors).toHaveLength(0);
  });

  it('should accept username with underscores and hyphens', async () => {
    const errors = await validateDto({ username: 'test_player-1' });
    expect(errors).toHaveLength(0);
  });

  it('should reject empty username', async () => {
    const errors = await validateDto({ username: '' });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should reject username shorter than 2 chars', async () => {
    const errors = await validateDto({ username: 'A' });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should reject username longer than 20 chars', async () => {
    const errors = await validateDto({ username: 'A'.repeat(21) });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should reject username with special characters', async () => {
    const errors = await validateDto({ username: 'test player!' });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should reject non-string username', async () => {
    const errors = await validateDto({ username: 12345 });
    expect(errors.length).toBeGreaterThan(0);
  });
});
