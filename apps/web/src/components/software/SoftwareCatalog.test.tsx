import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import SoftwareCatalog from './SoftwareCatalog';
import { fetchWithAuth } from '../../stores/auth';

vi.mock('../../stores/auth', () => ({
  fetchWithAuth: vi.fn(),
}));

vi.mock('./DeploymentWizard', () => ({
  default: () => <div>Deployment wizard</div>,
}));

vi.mock('./SoftwareVersionManager', () => ({
  default: () => <div>Version manager</div>,
}));

const fetchWithAuthMock = vi.mocked(fetchWithAuth);

const makeJsonResponse = (payload: unknown, ok = true, status = ok ? 200 : 500): Response =>
  ({
    ok,
    status,
    statusText: ok ? 'OK' : 'ERROR',
    json: vi.fn().mockResolvedValue(payload),
  }) as unknown as Response;

const catalogPayload = {
  data: [
    {
      id: 'pkg-chrome',
      name: 'Google Chrome',
      vendor: 'Google',
      category: 'browser',
      description: 'Fast browser',
      createdAt: '2026-05-01T00:00:00.000Z',
    },
    {
      id: 'pkg-firefox',
      name: 'Firefox',
      vendor: 'Mozilla',
      category: 'browser',
      description: 'Open browser',
      createdAt: '2026-05-02T00:00:00.000Z',
    },
  ],
};

describe('SoftwareCatalog deletion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deletes a package after confirmation and removes it from the library', async () => {
    fetchWithAuthMock
      .mockResolvedValueOnce(makeJsonResponse(catalogPayload))
      .mockResolvedValueOnce(makeJsonResponse({ success: true, id: 'pkg-chrome' }));

    render(<SoftwareCatalog />);

    expect(await screen.findByText('Google Chrome')).toBeInTheDocument();
    expect(screen.getByText('Firefox')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Delete Google Chrome' }));
    expect(screen.getByText('Delete Software Package')).toBeInTheDocument();
    expect(screen.getAllByText('Google Chrome').length).toBeGreaterThan(1);

    fireEvent.click(screen.getByRole('button', { name: 'Delete package' }));

    await waitFor(() => {
      expect(fetchWithAuthMock).toHaveBeenCalledWith('/software/catalog/pkg-chrome', {
        method: 'DELETE',
      });
    });

    await waitFor(() => {
      expect(screen.queryByText('Google Chrome')).not.toBeInTheDocument();
    });
    expect(screen.getByText('Firefox')).toBeInTheDocument();
  });
});
