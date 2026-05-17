import { escapeHtml } from '../brevo.service';

describe('escapeHtml', () => {
  it('escapes the five HTML-special characters', () => {
    expect(escapeHtml('<script>alert("xss")</script>')).toBe(
      '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;',
    );
  });

  it('escapes single quotes', () => {
    expect(escapeHtml(`O'Reilly's Spa`)).toBe('O&#39;Reilly&#39;s Spa');
  });

  it('escapes ampersand first so already-escaped entities are double-escaped (round-trip safe)', () => {
    expect(escapeHtml('Tom & Jerry')).toBe('Tom &amp; Jerry');
  });

  it('leaves plain ASCII unchanged', () => {
    expect(escapeHtml('Hola Massage Tulum')).toBe('Hola Massage Tulum');
  });

  it('leaves non-ASCII characters unchanged (Unicode passes through)', () => {
    expect(escapeHtml('Acceder a mi cuenta →')).toBe('Acceder a mi cuenta →');
    expect(escapeHtml('Bienvenido — tu estudio')).toBe('Bienvenido — tu estudio');
  });

  it('preserves URL query separators by escaping the &', () => {
    expect(escapeHtml('https://example.com/?a=1&b=2')).toBe('https://example.com/?a=1&amp;b=2');
  });

  it('handles empty string', () => {
    expect(escapeHtml('')).toBe('');
  });
});
