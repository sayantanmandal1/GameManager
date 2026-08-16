import { ServiceUnavailableException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  it('returns ok only after the database responds', async () => {
    const dataSource = { query: jest.fn().mockResolvedValue([{ '?column?': 1 }]) };
    const controller = new HealthController(dataSource as unknown as DataSource);

    await expect(controller.check()).resolves.toEqual({ status: 'ok' });
    expect(dataSource.query).toHaveBeenCalledWith('SELECT 1');
  });

  it('returns a generic unavailable error without leaking database details', async () => {
    const dataSource = {
      query: jest.fn().mockRejectedValue(new Error('password for db-user was rejected')),
    };
    const controller = new HealthController(dataSource as unknown as DataSource);

    await expect(controller.check()).rejects.toEqual(
      new ServiceUnavailableException('Service unavailable'),
    );
  });
});