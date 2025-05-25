const ApiModel = require('../models/apiModel');
const Ajv = require('ajv');

class ApiController {
  constructor(exchangeController, stateStore, blockchainClient) {
    if (!exchangeController || typeof exchangeController.logComplianceEvent !== 'function') {
      throw new Error('Valid exchangeController required');
    }
    this.ajv = new Ajv({ allErrors: true });
    this.model = new ApiModel(stateStore, blockchainClient);
    this.exchangeController = exchangeController;

    // Input validation schemas
    this.registerEndpointSchema = {
      type: 'object',
      required: ['path', 'method', 'description'],
      properties: {
        path: { type: 'string', minLength: 1 },
        method: { type: 'string', enum: ['GET', 'POST', 'PUT', 'DELETE'] },
        description: { type: 'string', minLength: 1 }
      },
      additionalProperties: false
    };

    this.logRequestSchema = {
      type: 'object',
      required: ['endpointId', 'payload'],
      properties: {
        endpointId: { type: 'string', format: 'uuid' },
        userId: { type: 'string', minLength: 1 },
        payload: { type: 'object' }
      },
      additionalProperties: false
    };

    this.logResponseSchema = {
      type: 'object',
      required: ['requestId', 'data', 'statusCode'],
      properties: {
        requestId: { type: 'string', format: 'uuid' },
        data: { type: 'object' },
        statusCode: { type: 'number', minimum: 100, maximum: 599 }
      },
      additionalProperties: false
    };

    this.validateRegisterEndpoint = this.ajv.compile(this.registerEndpointSchema);
    this.validateLogRequest = this.ajv.compile(this.logRequestSchema);
    this.validateLogResponse = this.ajv.compile(this.logResponseSchema);
  }

  async registerEndpoint(req, res) {
    try {
      if (!this.validateRegisterEndpoint(req.body)) {
        throw new Error(`Invalid input: ${JSON.stringify(this.validateRegisterEndpoint.errors, null, 2)}`);
      }

      const { path, method, description } = req.body;
      const endpoint = await this.model.saveEndpoint({ path, method: method.toUpperCase(), description });
      await this.exchangeController.logComplianceEvent(
        'endpoint_registered',
        'system',
        JSON.stringify({ path, method })
      );
      res.status(201).json(endpoint);
    } catch (error) {
      await this.exchangeController.logComplianceEvent('error', 'system', JSON.stringify({ error: error.message }));
      res.status(400).json({ message: error.message });
    }
  }

  async logRequest(req, res) {
    try {
      if (!this.validateLogRequest(req.body)) {
        throw new Error(`Invalid input: ${JSON.stringify(this.validateLogRequest.errors, null, 2)}`);
      }

      const { endpointId, userId, payload } = req.body;
      const endpoint = this.model.getApiData().schema.outputs.endpointResult;
      if (!endpoint || endpoint.id !== endpointId) {
        throw new Error('Endpoint not found');
      }

      const request = await this.model.saveRequest({ endpoint: endpointId, user: userId || 'anonymous', payload });
      await this.exchangeController.logComplianceEvent(
        'api_request',
        request.user,
        JSON.stringify({ endpointId, payload })
      );
      res.status(201).json(request);
    } catch (error) {
      await this.exchangeController.logComplianceEvent('error', 'system', JSON.stringify({ error: error.message }));
      res.status(400).json({ message: error.message });
    }
  }

  async logResponse(req, res) {
    try {
      if (!this.validateLogResponse(req.body)) {
        throw new Error(`Invalid input: ${JSON.stringify(this.validateLogResponse.errors, null, 2)}`);
      }

      const { requestId, data, statusCode } = req.body;
      const request = this.model.getApiData().schema.outputs.requestResult;
      if (!request || request.id !== requestId) {
        throw new Error('Request not found');
      }

      const response = await this.model.saveResponse({ request: requestId, data, statusCode });
      await this.exchangeController.logComplianceEvent(
        'api_response',
        request.user,
        JSON.stringify({ requestId, statusCode })
      );
      res.status(201).json(response);
    } catch (error) {
      await this.exchangeController.logComplianceEvent('error', 'system', JSON.stringify({ error: error.message }));
      res.status(400).json({ message: error.message });
    }
  }

  async getEndpointRequests(req, res) {
    try {
      const endpointId = req.params.id;
      if (!this.ajv.validate({ type: 'string', format: 'uuid' }, endpointId)) {
        throw new Error('Invalid endpointId: must be a UUID');
      }

      const requests = await this.model.getEndpointRequests(endpointId);
      res.status(200).json(requests);
    } catch (error) {
      await this.exchangeController.logComplianceEvent('error', 'system', JSON.stringify({ error: error.message }));
      res.status(500).json({ message: error.message });
    }
  }

  async getRequestResponses(req, res) {
    try {
      const requestId = req.params.id;
      if (!this.ajv.validate({ type: 'string', format: 'uuid' }, requestId)) {
        throw new Error('Invalid requestId: must be a UUID');
      }

      const responses = await this.model.getRequestResponses(requestId);
      res.status(200).json(responses);
    } catch (error) {
      await this.exchangeController.logComplianceEvent('error', 'system', JSON.stringify({ error: error.message }));
      res.status(500).json({ message: error.message });
    }
  }
}

module.exports = ApiController;