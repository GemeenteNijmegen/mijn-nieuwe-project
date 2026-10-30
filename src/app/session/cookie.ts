
export type SameSite = 'Strict' | 'Lax' | 'None';

export interface CookieOptions {
  path?: string;
  secure?: boolean;
  httpOnly?: boolean;
  sameSite?: SameSite;
  maxAge?: number; // in seconds
}

export class Cookie {
  private name: string;
  private value: string;
  private path: string = '/';
  private secure: boolean = true;
  private httpOnly: boolean = true;
  private sameSite: SameSite = 'Lax';
  private maxAge?: number; // in seconds

  constructor(name: string, value: string, options: CookieOptions = {}) {
    this.name = name;
    this.value = value;
    this.path = options.path ?? '/';
    this.secure = options.secure ?? true;
    this.httpOnly = options.httpOnly ?? true;
    this.sameSite = options.sameSite ?? 'Lax';
    this.maxAge = options.maxAge;
  }

  toString(): string {
    let cookieString = `${this.name}=${this.value}; Path=${this.path}, SameSite=${this.sameSite}`;
    if (this.secure) {
      cookieString += '; Secure';
    }
    if (this.httpOnly) {
      cookieString += '; HttpOnly';
    }
    if (this.maxAge !== undefined) {
      cookieString += `; Max-Age=${this.maxAge}`;
    }
    return cookieString;
  }
}