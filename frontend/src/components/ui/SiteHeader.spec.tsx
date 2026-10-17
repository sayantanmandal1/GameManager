import { render, screen } from '@testing-library/react';
import { SiteHeader } from './SiteHeader';
import { useAuthStore } from '@/stores/authStore';

let mockPathname = '/games';

jest.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: React.ImgHTMLAttributes<HTMLImageElement> & { priority?: boolean }) => {
    const imgProps = { ...props };
    delete imgProps.priority;
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    return <img {...imgProps} />;
  },
}));

type TestWindow = Window & { ReactNativeWebView?: { postMessage: () => void } };

describe('SiteHeader', () => {
  beforeEach(() => {
    mockPathname = '/games';
    useAuthStore.setState({
      isAuthenticated: true,
      user: { id: 'u1', username: 'Alex', avatar: 'A' },
      token: 'token',
    });
  });

  afterEach(() => {
    delete (window as TestWindow).ReactNativeWebView;
  });

  it('links signed-in browser players to the Android app download page', () => {
    render(<SiteHeader />);
    expect(screen.getByRole('link', { name: 'Get app' })).toHaveAttribute('href', '/download');
  });

  it('hides itself inside the Android app, which provides native navigation', () => {
    (window as TestWindow).ReactNativeWebView = { postMessage: jest.fn() };
    const { container } = render(<SiteHeader />);
    expect(container).toBeEmptyDOMElement();
  });

  it('stays out of the way on the download page and during play', () => {
    mockPathname = '/download';
    const { container, rerender } = render(<SiteHeader />);
    expect(container).toBeEmptyDOMElement();
    mockPathname = '/games/uno/play/123456';
    rerender(<SiteHeader />);
    expect(container).toBeEmptyDOMElement();
  });
});
