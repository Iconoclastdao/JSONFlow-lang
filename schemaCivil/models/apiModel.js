const crypto = require('crypto');
const Ajv = require('ajv');
const apiSchema = require('../api/api.schema.json');

class ApiModel {
  constructor(stateStore, blockchainClient) {
    this.ajv = new Ajv({ allErrors: true });
    this.validate = this.ajv.compile(apiSchema);
    this.stateStore = stateStore || { store: 'in-memory', data: { endpoints: [], requests: [], responses: [] } };
    this.blockchainClient = blockchainClient || { logTransaction: async () => {} };
    this.apiData = {
      function: 'sovereignApi',
      schema: {
        inputs: { endpoint: {}, request: {}, response: {} },
        outputs: { endpointResult: {}, requestResult: {}, responseResult: {} }
      },
      metadata: {
        schema_version: '5.3.1',
        version: '1.0.0',
        author: 'xAI Team',
        description: 'Sovereign DApp API with blockchain and governance integration.',
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
        tags: ['api', 'blockchain', 'governance'],
        examples: ['https://github.com/xai/sovereign-api-examples'],
        docs: 'https://docs.xai/sovereign-api',
        tooling: ['vscode', 'jsonflow-cli'],
        compliance: ['GDPR', 'PCI-DSS'],
        license: 'MIT'
      },
      security: {
        authentication: { type: 'jwt', provider: 'custom' },
        authorization: { type: 'rbac', roles: ['admin', 'user'], permissions: ['register_endpoint', 'log_request'] },
        encryption: { algorithm: 'AES-256', key_management: 'vault' },
        secrets: { manager: 'hashicorp-vault', refs: ['api_key_ref'] }
      },
      observability: {
        logging: { provider: 'loki', level: 'info' },
        metrics: { provider: 'prometheus', endpoints: ['http://metrics.sovereign.local'] },
        tracing: { provider: 'opentelemetry', sampling_rate: 1 },
        telemetry: { provider: 'opentelemetry' }
      },
      orchestration: { type: 'sequential', runtime: 'nodejs' }
    };
    this.validateData(this.apiData);
  }

  validateData(data) {
    if (!this.validate(data)) {
      throw new Error(`Data validation failed: ${JSON.stringify(this.validate.errors, null, 2)}`);
    }
    return true;
  }

  async saveEndpoint(endpoint) {
    const endpointData = {
      id: crypto.randomUUID(),
      ...endpoint,
      status: 'active',
      createdAt: new Date().toISOString()
    };
    this.apiData.schema.outputs.endpointResult = endpointData;
    this.stateStore.data.endpoints.push(endpointData);
    await this.blockchainClient.logTransaction('endpoint_registered', { endpoint: endpointData.id });
    this.validateData(this.apiData);
    return endpointData;
  }

  async saveRequest(request) {
    const requestData = {
      id: crypto.randomUUID(),
      ...request,
      status: 'received',
      timestamp: new Date().toISOString()
    };
    this.apiData.schema.outputs.requestResult = requestData;
    this.stateStore.data.requests.push(requestData);
    await this.blockchainClient.logTransaction('api_request', { request: requestData.id });
    this.validateData(this.apiData);
    return requestData;
  }

  async saveResponse(response) {
    const responseData = {
      id: crypto.randomUUID(),
      ...response,
      timestamp: new Date().toISOString()
    };
    this.apiData.schema.outputs.responseResult = responseData;
    this.stateStore.data.responses.push(responseData);
    await this.blockchainClient.logTransaction('api_response', { response: responseData.id });
    this.validateData(this.apiData);
    return responseData;
  }

  async getEndpointRequests(endpointId) {
    return this.stateStore.data.requests.filter(r => r.endpoint === endpointId);
  }

  async getRequestResponses(requestId) {
    return this.stateStore.data.responses.filter(r => r.request === requestId);
  }

  getApiData() {
    return this.apiData;
  }
}

module.exports = ApiModel;