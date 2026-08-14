import {
  GrantsGovSearchParams,
  GrantsGovSearchResponse,
  GrantsGovDetailResponse,
  GrantsGovSearchHit,
} from './grantsGovTypes';
import {
  GrantsGovSearchResponseSchema,
  GrantsGovDetailResponseSchema,
} from './grantsGovSchemas';

export interface GrantsGovClientConfig {
  baseUrl?: string;
  timeoutMs?: number;
  maxRetries?: number;
}

export class GrantsGovClient {
  private baseUrl: string;
  private timeoutMs: number;
  private maxRetries: number;
  private userAgent = 'BridgeAI-FundingIntelligence/1.0 (Project Thriveward)';

  constructor(config?: GrantsGovClientConfig) {
    this.baseUrl = (config?.baseUrl || process.env.GRANTS_GOV_API_BASE_URL || 'https://api.grants.gov').replace(/\/$/, '');
    this.timeoutMs = config?.timeoutMs || Number(process.env.GRANTS_GOV_REQUEST_TIMEOUT_MS) || 15000;
    this.maxRetries = config?.maxRetries ?? 3;
  }

  /**
   * Execute POST request with timeout and exponential backoff retry for HTTP 429/5xx
   */
  private async executePostRequest<T>(endpoint: string, body: any): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    let attempt = 0;

    while (attempt < this.maxRetries) {
      attempt++;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': this.userAgent,
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if ((response.status === 429 || response.status >= 500) && attempt < this.maxRetries) {
          const delayMs = Math.pow(2, attempt) * 500;
          console.warn(`[GrantsGovClient] HTTP ${response.status} on ${endpoint}. Retrying attempt ${attempt}/${this.maxRetries} after ${delayMs}ms...`);
          await new Promise((r) => setTimeout(r, delayMs));
          continue;
        }

        if (!response.ok) {
          throw new Error(`Grants.gov API returned HTTP status ${response.status} for ${endpoint}`);
        }

        const json = await response.json();
        return json as T;
      } catch (err: any) {
        clearTimeout(timeoutId);
        if (attempt >= this.maxRetries) {
          throw new Error(`Grants.gov request failed on ${endpoint}: ${err.message || 'Network error'}`);
        }
        const delayMs = Math.pow(2, attempt) * 500;
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }

    throw new Error(`Grants.gov request to ${endpoint} exceeded maximum retry limit of ${this.maxRetries}`);
  }

  /**
   * POST /v1/api/search2
   */
  async searchOpportunities(params: GrantsGovSearchParams): Promise<GrantsGovSearchResponse> {
    const payload = {
      keyword: params.keyword || '',
      oppStatuses: params.oppStatuses || 'forecasted|posted',
      startRecordNum: params.startRecordNum ?? 0,
      rows: Math.min(params.rows || 10, 25),
    };

    const rawResponse = await this.executePostRequest<any>('/v1/api/search2', payload);
    const dataContainer = rawResponse?.data || rawResponse;
    const hits: GrantsGovSearchHit[] = dataContainer?.oppHits || dataContainer?.opportunityHits || [];

    const result: GrantsGovSearchResponse = {
      opportunityHits: hits,
      hitCount: dataContainer?.hitCount || hits.length,
      totalCount: dataContainer?.totalCount || hits.length,
    };

    const parseResult = GrantsGovSearchResponseSchema.safeParse(result);
    if (!parseResult.success) {
      console.warn('[GrantsGovClient] Search payload validation warning:', parseResult.error.format());
    }

    return result;
  }

  /**
   * POST /v1/api/fetchOpportunity
   */
  async fetchOpportunity(opportunityId: string | number): Promise<GrantsGovDetailResponse> {
    const numOppId = Number(opportunityId);
    if (!opportunityId || isNaN(numOppId) || numOppId <= 0) {
      throw new Error('fetchOpportunity requires a valid non-empty numeric opportunityId');
    }

    const payload = {
      opportunityId: numOppId,
    };

    const rawResponse = await this.executePostRequest<any>('/v1/api/fetchOpportunity', payload);

    if (!rawResponse || typeof rawResponse !== 'object') {
      throw new Error('Invalid or missing response from Grants.gov fetchOpportunity');
    }

    if (rawResponse.errorcode !== undefined && rawResponse.errorcode !== 0) {
      throw new Error(`Grants.gov API returned errorcode ${rawResponse.errorcode}: ${rawResponse.msg || 'Fetch opportunity failed'}`);
    }

    if (!rawResponse.data || typeof rawResponse.data !== 'object') {
      throw new Error('Invalid or missing data payload in Grants.gov response');
    }

    const dataObj = rawResponse.data;
    const returnedId = String(dataObj.id ?? dataObj.oppId ?? dataObj.opportunityId ?? dataObj.synopsis?.opportunityId ?? '');

    if (!returnedId || returnedId !== String(opportunityId)) {
      throw new Error(`Identity Mismatch: Requested opp ID '${opportunityId}' does not match response detail ID '${returnedId}'`);
    }

    const parseResult = GrantsGovDetailResponseSchema.safeParse(dataObj);
    if (!parseResult.success) {
      console.warn('[GrantsGovClient] Detail payload validation warning:', parseResult.error.format());
    }

    return dataObj as GrantsGovDetailResponse;
  }
}
