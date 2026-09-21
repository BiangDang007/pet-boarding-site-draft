// test.js — run with: node test.js
// Pure-logic tests for store.js (no IndexedDB / no browser needed).
const assert = require('node:assert');
const { bookingsOnDay, customerSummary, deleteCustomerCascade, feeDefaultsFromBooking } = require('./store.js');

function makeData() {
  return {
    plans: [{ id: 'p1', name: '示意方案 A', price: 500 }],
    customers: [{ id: 'c1', name: '客戶一' }, { id: 'c2', name: '客戶二' }],
    bookings: [
      { id: 'b1', customerId: 'c1', planId: 'p1', startDate: '2026-09-10', endDate: '2026-09-12', status: '已確認', notes: '' },
      { id: 'b2', customerId: 'c2', planId: 'p1', startDate: '2026-09-15', endDate: '2026-09-15', status: '待確認', notes: '' }
    ],
    fees: [
      { id: 'f1', customerId: 'c1', bookingId: 'b1', item: '示意方案 A', price: 500, status: '待付款' },
      { id: 'f2', customerId: 'c1', bookingId: 'b1', item: '加購', price: 100, status: '已付款' },
      { id: 'f3', customerId: 'c1', bookingId: 'b1', item: '取消項目', price: 200, status: '已取消' }
    ],
    folders: [], photos: [], messages: [], settings: {}
  };
}

// 1. multi-day booking appears on every day of its range and not the day after
{
  const data = makeData();
  assert.ok(bookingsOnDay(data, '2026-09-10').some(b => b.id === 'b1'), 'start day should include b1');
  assert.ok(bookingsOnDay(data, '2026-09-11').some(b => b.id === 'b1'), 'middle day should include b1');
  assert.ok(bookingsOnDay(data, '2026-09-12').some(b => b.id === 'b1'), 'end day should include b1');
  assert.ok(!bookingsOnDay(data, '2026-09-13').some(b => b.id === 'b1'), 'day after range should NOT include b1');
  console.log('PASS: multi-day booking range');
}

// 2. cancelled fee excluded, paid excluded, 待付款 included from unpaidTotal
{
  const data = makeData();
  const summary = customerSummary(data, 'c1');
  assert.strictEqual(summary.unpaidTotal, 500, 'only the 待付款 fee (500) should count');
  console.log('PASS: unpaidTotal excludes paid/cancelled, includes 待付款');
}

// 3. cascade delete removes linked bookings+fees, leaves other customers intact
{
  const data = makeData();
  const result = deleteCustomerCascade(data, 'c1');
  assert.strictEqual(result.bookings, 1);
  assert.strictEqual(result.fees, 3);
  assert.strictEqual(data.customers.find(c => c.id === 'c1'), undefined);
  assert.strictEqual(data.bookings.find(b => b.customerId === 'c1'), undefined);
  assert.strictEqual(data.fees.find(f => f.customerId === 'c1'), undefined);
  assert.ok(data.customers.find(c => c.id === 'c2'), 'other customer must remain');
  assert.ok(data.bookings.find(b => b.customerId === 'c2'), "other customer's booking must remain");
  console.log('PASS: cascade delete removes only the target customer\'s records');
}

// 4. feeDefaultsFromBooking returns the plan's name/price
{
  const data = makeData();
  const defaults = feeDefaultsFromBooking(data, 'b1');
  assert.strictEqual(defaults.item, '示意方案 A');
  assert.strictEqual(defaults.price, 500);
  console.log('PASS: feeDefaultsFromBooking reads name/price from the plan');
}

console.log('ALL TESTS PASSED');
