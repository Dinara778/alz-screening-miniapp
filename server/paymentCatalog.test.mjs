import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  catalogPriceRub,
  paymentTypeForProduct,
  resolveAmountRub,
} from './paymentCatalog.mjs';

describe('paymentCatalog', () => {
  it('resolves catalog prices', () => {
    assert.equal(catalogPriceRub('full_report'), 149);
    assert.equal(catalogPriceRub('subscription_1m'), 499);
    assert.equal(catalogPriceRub('subscription_3m'), 990);
    assert.equal(catalogPriceRub('unknown'), null);
  });

  it('prefers paid OutSum over catalog', () => {
    assert.equal(resolveAmountRub(149, 'full_report'), 149);
    assert.equal(resolveAmountRub(399, 'full_report'), 399);
    assert.equal(resolveAmountRub(null, 'subscription_1m'), 499);
    assert.equal(resolveAmountRub(0, 'subscription_1m'), 499);
  });

  it('maps product to payment type', () => {
    assert.equal(paymentTypeForProduct('subscription_1m'), 'subscription');
    assert.equal(paymentTypeForProduct('full_report'), 'one_time');
  });
});
