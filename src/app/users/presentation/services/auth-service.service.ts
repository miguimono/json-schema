import {Inject, Injectable} from '@angular/core';
import {Observable, of} from "rxjs";
import {HttpClient, HttpHeaders} from "@angular/common/http";
import {Router} from "@angular/router";
import * as forge from 'node-forge';

/** Public Key into Environment Variable Deployment */
const publicKeyPem = '-----BEGIN PUBLIC KEY-----\n' +
  'MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQCPP+NlfOS/cYdJ1dkbg3EMGY/8JJgl\n' +
  '2Op89RNUIB6zJ8O3vD1dwmR4f/zIYx9tOOMgMxm3LmlhoF2LoYuC0mUuPcnXbgY2VPVY\n' +
  'WC73DE82Ejn31YDGz79K9ufmPiyT6Sxnx6V0PQFJIQf1SMQaSoaKdUe9BSIn0ODKC1Xi\n' +
  'BJBefwIDAQAB' +
  '-----END PUBLIC KEY-----';

/** Headers Request */
const httpOptions = {
  headers: new HttpHeaders({
    'Content-Type': 'application/json',
  }), withCredentials: true,
};

@Injectable({
  providedIn: 'root'
})
export class AuthService {

  publicKey = forge.pki.publicKeyFromPem(publicKeyPem);
  public user: any = null;

  constructor(private http: HttpClient,
              private router: Router,
              @Inject('BASE_URL') public baseUrl: string) {
  }

  /** Generate Captcha */
  generateCaptcha() {
    return this.http.post<any>(this.baseUrl + 'api/generate-captcha', { headers: httpOptions, responseType: 'json' });
  }

  /** Validate Captcha */
  validateCaptcha(data: any) {
    const url = `${this.baseUrl}api/validate-captcha?code=${data.code}&space=${data.space}`;
    return this.http.post<any>(url, { headers: httpOptions, responseType: 'json' });
  }

  /** Encryption Data */
  generateDataRsa(data: string): string {
    const encryptedData = this.publicKey.encrypt(data, 'RSA-OAEP', {
      md: forge.md.sha1.create(),
      mgf1: {
        md: forge.md.sha1.create()
      }
    });
    return forge.util.encode64(encryptedData);
  }

  /** Validate Login **/
  postValidateLogin(body: any): Observable<any> {
    const headers = new HttpHeaders().set('Content-Type', 'application/x-www-form-urlencoded');
    return this.http.post(this.baseUrl + 'api/validate-login', body, { headers, withCredentials: true});
  }

  /** LDAP User Authentication */
  postLoginDataAuthorization(body: any): Observable<any> {
    const headers = new HttpHeaders().set('Content-Type', 'application/x-www-form-urlencoded');
    return this.http.post(this.baseUrl + 'api/manage-login', body, { headers, withCredentials: true });
  }

  /** Token Validated */
  isAuthenticated() {
    let token = sessionStorage.getItem('token');
    return of(token);
  }

  /** Close Session */
  logout() {
    this.router.navigate(['']).then(r => {});
    sessionStorage.clear();
  }

}
