import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { App } from './app';
import { LanguageService } from './core/i18n/language.service';
import { API_BASE_URL } from './core/tokens/api-base-url.token';

describe('App', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        { provide: API_BASE_URL, useValue: 'http://localhost:3000' },
      ],
    }).compileComponents();

    fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      return {
        ok: true,
        json: async () => ({
          'app.name': 'Pokefifa',
          'nav.menu': 'Menu',
          'nav.home': 'Home',
          'nav.login': 'Login',
          'nav.register': 'Register',
        }),
      } as Response;
    });

    const languageService = TestBed.inject(LanguageService);
    await languageService.init();
  });

  afterEach(() => {
    fetchSpy.mockRestore();
    globalThis.localStorage?.clear();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render navbar brand', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Pokefifa');
  });
});
