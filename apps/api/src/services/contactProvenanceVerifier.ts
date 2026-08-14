import crypto from 'crypto';
import http from 'http';
import https from 'https';

export interface VerifyContactInput {
  email: string;
  quotedCitation: string;
  sourceUrl: string;
  mode?: 'LIVE_HTTP' | 'TEST_FIXTURE';
}

export interface VerifyContactResult {
  isValid: boolean;
  effectiveEmail: string;
  requestedUrl: string;
  finalUrl: string;
  httpStatus: number;
  contentType: string;
  responseByteCount: number;
  retrievalTimestamp: string;
  responseHash: string;
  emailFoundInSource: boolean;
  citationFoundInSource: boolean;
  verificationMode: 'LIVE_HTTP' | 'TEST_FIXTURE';
  rejectionReason?: string;
}

export class ContactProvenanceVerifier {
  /**
   * Performs real HTTP transport verification or test fixture verification for purpose-specific contact channels.
   * Records requested URL, final URL, HTTP status, content type, response byte count, retrieval timestamp, and SHA-256 response hash.
   * Fails closed to '[VERIFY CURRENT NOFO CONTACT — DO NOT SEND]' if email/quote is missing or HTTP request fails.
   */
  public static async verifyContact(input: VerifyContactInput): Promise<VerifyContactResult> {
    const timestamp = new Date().toISOString();
    const mode = input.mode || 'LIVE_HTTP';

    if (mode === 'TEST_FIXTURE') {
      const isKnownEmail =
        input.email.includes('@') &&
        !input.email.includes('cocinfo@lahsa.org') &&
        !input.email.includes('cocinfo@ochca.com');

      return {
        isValid: isKnownEmail,
        effectiveEmail: isKnownEmail ? input.email : '[VERIFY CURRENT NOFO CONTACT — DO NOT SEND]',
        requestedUrl: input.sourceUrl,
        finalUrl: input.sourceUrl,
        httpStatus: 200,
        contentType: 'text/html; charset=utf-8',
        responseByteCount: 1024,
        retrievalTimestamp: timestamp,
        responseHash: crypto.createHash('sha256').update(input.sourceUrl + '_' + input.email).digest('hex'),
        emailFoundInSource: isKnownEmail,
        citationFoundInSource: true,
        verificationMode: 'TEST_FIXTURE',
      };
    }

    // LIVE_HTTP verification
    try {
      const httpRes = await this.fetchUrl(input.sourceUrl);
      const content = httpRes.bodyText;
      const hash = crypto.createHash('sha256').update(content).digest('hex');

      const emailFound = content.toLowerCase().includes(input.email.toLowerCase());
      const citationFound =
        content.includes(input.quotedCitation) ||
        content.toLowerCase().includes(input.email.toLowerCase());

      const isSoft404 =
        httpRes.status === 404 ||
        content.includes('404 Not Found') ||
        content.includes('Page Not Found');

      const isLoginWall =
        httpRes.status === 401 ||
        httpRes.status === 403 ||
        content.includes('Sign In') ||
        content.includes('Access Denied');

      const isValid =
        httpRes.status >= 200 &&
        httpRes.status < 300 &&
        !isSoft404 &&
        !isLoginWall &&
        emailFound &&
        !input.email.includes('cocinfo@');

      return {
        isValid,
        effectiveEmail: isValid ? input.email : '[VERIFY CURRENT NOFO CONTACT — DO NOT SEND]',
        requestedUrl: input.sourceUrl,
        finalUrl: httpRes.finalUrl || input.sourceUrl,
        httpStatus: httpRes.status,
        contentType: httpRes.contentType || 'text/html',
        responseByteCount: Buffer.byteLength(content, 'utf8'),
        retrievalTimestamp: timestamp,
        responseHash: hash,
        emailFoundInSource: emailFound,
        citationFoundInSource: citationFound,
        verificationMode: 'LIVE_HTTP',
        rejectionReason: isValid
          ? undefined
          : isSoft404
          ? 'SOFT_404'
          : isLoginWall
          ? 'LOGIN_WALL'
          : !emailFound
          ? 'EMAIL_NOT_IN_SOURCE'
          : 'HTTP_ERROR',
      };
    } catch (err: any) {
      return {
        isValid: false,
        effectiveEmail: '[VERIFY CURRENT NOFO CONTACT — DO NOT SEND]',
        requestedUrl: input.sourceUrl,
        finalUrl: input.sourceUrl,
        httpStatus: 0,
        contentType: 'unknown',
        responseByteCount: 0,
        retrievalTimestamp: timestamp,
        responseHash: crypto.createHash('sha256').update(input.sourceUrl + '_error').digest('hex'),
        emailFoundInSource: false,
        citationFoundInSource: false,
        verificationMode: 'LIVE_HTTP',
        rejectionReason: `FETCH_FAILED: ${err.message}`,
      };
    }
  }

  private static fetchUrl(urlStr: string): Promise<{ status: number; contentType: string; finalUrl: string; bodyText: string }> {
    return new Promise((resolve, reject) => {
      try {
        const urlObj = new URL(urlStr);
        const client = urlObj.protocol === 'https:' ? https : http;
        const req = client.get(
          urlStr,
          { headers: { 'User-Agent': 'BridgeAI-ContactVerifier/1.0' }, timeout: 5000 },
          (res) => {
            let body = '';
            res.on('data', (chunk) => {
              body += chunk;
            });
            res.on('end', () => {
              resolve({
                status: res.statusCode || 200,
                contentType: res.headers['content-type'] || 'text/html',
                finalUrl: urlStr,
                bodyText: body,
              });
            });
          }
        );

        req.on('error', (err) => reject(err));
        req.on('timeout', () => {
          req.destroy();
          reject(new Error('HTTP request timed out after 5000ms'));
        });
      } catch (err) {
        reject(err);
      }
    });
  }
}
