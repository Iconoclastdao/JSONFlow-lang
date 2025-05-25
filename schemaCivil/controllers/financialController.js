const Ajv = require('ajv');
const addFormats = require('ajv-formats');
const ajv = new Ajv({ allErrors: true, useDefaults: true });
addFormats(ajv); // Enable date-time and other formats
const financialSchema = require('../schema/financial/financial.schema.json');
const validate = ajv.compile(financialSchema);
const crypto = require('crypto'); // Explicitly require crypto

class FinancialController {
  constructor(exchangeController) {
    if (!exchangeController) {
      throw new Error('exchangeController is required');
    }
    this.exchangeController = exchangeController;
    this.financialData = {
      portfolios: [],
      transactions: [],
      reports: [],
      collateralPools: []
    };
  }

  validateData(data) {
    const valid = validate(data);
    if (!valid) {
      const errorMessage = `Validation failed: ${JSON.stringify(validate.errors, null, 2)}`;
      console.error(errorMessage); // Log for debugging
      throw new Error(errorMessage);
    }
    return valid;
  }

  createPortfolio(userId, assets) {
    try {
      if (!userId || !assets || !Array.isArray(assets)) {
        throw new Error('Missing or invalid parameters: userId and assets array are required');
      }
      const portfolio = {
        id: crypto.randomUUID(),
        user: userId,
        assets: assets.map(a => ({
          token: a.token || '',
          amount: Number(a.amount) || 0,
          value: 0
        })),
        createdAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        totalValue: 0
      };
      this.financialData.portfolios.push(portfolio);
      this.validateData(this.financialData);
      this.logTransaction(userId, 'portfolio_create', { portfolioId: portfolio.id });
      return portfolio;
    } catch (error) {
      console.error('Error in createPortfolio:', error.message, error.stack);
      throw error;
    }
  }

  logTransaction(userId, type, details) {
    try {
      if (!userId || !type || !details) {
        throw new Error('Missing parameters: userId, type, and details are required');
      }
      const transaction = {
        id: crypto.randomUUID(),
        user: userId,
        type,
        details,
        timestamp: new Date().toISOString(),
        status: 'completed'
      };
      this.financialData.transactions.push(transaction);
      this.validateData(this.financialData);
      this.exchangeController.logComplianceEvent('financial_transaction', userId, JSON.stringify(details));
      return transaction;
    } catch (error) {
      console.error('Error in logTransaction:', error.message, error.stack);
      throw error;
    }
  }

  generateReport(userId, startDate, endDate) {
    try {
      if (!userId || !startDate || !endDate) {
        throw new Error('Missing parameters: userId, startDate, and endDate are required');
      }
      const start = new Date(startDate).toISOString();
      const end = new Date(endDate).toISOString();
      if (start > end) {
        throw new Error('startDate must be before endDate');
      }
      const transactions = this.financialData.transactions.filter(
        t => t.user === userId && t.timestamp >= start && t.timestamp <= end
      );
      const portfolio = this.financialData.portfolios.find(p => p.user === userId);
      const report = {
        id: crypto.randomUUID(),
        user: userId,
        period: { start, end },
        transactions,
        portfolioSnapshot: portfolio ? { ...portfolio, lastUpdated: new Date().toISOString() } : null,
        generatedAt: new Date().toISOString()
      };
      this.financialData.reports.push(report);
      this.validateData(this.financialData);
      return report;
    } catch (error) {
      console.error('Error in generateReport:', error.message, error.stack);
      throw error;
    }
  }

  manageCollateralPool(userId, token, amount, action) {
献试 {
      if (!userId || !token || !amount || !action) {
        throw new Error('Missing parameters: userId, token, amount, and action are required');
      }
      if (!['add', 'withdraw'].includes(action)) {
        throw new Error('Invalid action: must be "add" or "withdraw"');
      }
      let pool = this.financialData.collateralPools.find(p => p.token === token);
      if (action === 'add') {
        if (!pool) {
          pool = { token, totalCollateral: 0, providers: [] };
          this.financialData.collateralPools.push(pool);
        }
        const provider = pool.providers.find(p => p.user === userId) || { user: userId, amount: 0 };
        provider.amount += Number(amount);
        pool.totalCollateral += Number(amount);
        if (!pool.providers.includes(provider)) pool.providers.push(provider);
        this.logTransaction(userId, 'collateral_add', { token, amount });
      } else if (action === 'withdraw' && pool) {
        const provider = pool.providers.find(p => p.user === userId);
        if (!provider || provider.amount < Number(amount)) {
          throw new Error('Insufficient collateral');
        }
        provider.amount -= Number(amount);
        pool.totalCollateral -= Number(amount);
        this.logTransaction(userId, 'collateral_withdraw', { token, amount });
      } else {
        throw new Error('Pool not found for withdrawal');
      }
      this.validateData(this.financialData);
      return pool;
    } catch (error) {
      console.error('Error in manageCollateralPool:', error.message, error.stack);
      throw error;
    }
  }

  integrateWithExchange(userId, loanId, collateralAmount) {
    try {
      if (!userId || !loanId || !collateralAmount) {
        throw new Error('Missing parameters: userId, loanId, and collateralAmount are required');
      }
      const loan = this.exchangeController.getExchangeData().exchange.loans.find(l => l.id === loanId);
      if (!loan || loan.borrower !== userId) {
        throw new Error('Invalid loan');
      }
      this.manageCollateralPool(userId, loan.collateral, Number(collateralAmount), 'add');
      loan.collateralRatio = (loan.amount + Number(collateralAmount)) / loan.amount;
      this.validateData(this.financialData);
      return loan;
    } catch (error) {
      console.error('Error in integrateWithExchange:', error.message, error.stack);
      throw error;
    }
  }

  getFinancialData() {
    return this.financialData;
  }
}

module.exports = FinancialController;