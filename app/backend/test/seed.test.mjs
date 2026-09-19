import assert from 'node:assert/strict';
import test from 'node:test';
import { aggregateDataset, createSeed, DATASET_VERSION, SECTIONS } from '../dist/seed.js';

test('seed keeps one identified case, three requirements and explicitly preset initial evidence', () => {
  const s = createSeed();
  assert.equal(s.schemaVersion, '1.0');
  assert.equal(s.datasetVersion, DATASET_VERSION);
  assert.equal(s.dataset.version, DATASET_VERSION);
  assert.equal(s.candidate.name, 'Alex Chen');
  assert.equal(s.job.company, 'HarbourCart Pty Ltd');
  assert.equal(s.job.title, 'Junior Data Analyst');
  assert.deepEqual(s.job.requirements.map(r => r.id), ['sql', 'data-analysis', 'business-problem-solving']);
  assert.equal(s.application.mode, 'preset');
  assert.deepEqual(s.application.initialReport.map(r => r.status), ['supported', 'supported', 'uncertain']);
  assert.ok(s.application.initialReport.every(r => r.mode === 'preset'));
  assert.deepEqual(s.application.sources.map(s => s.kind), ['sql_example', 'calculation_table', 'self_statement']);
  assert.equal(s.task.requirementId, 'business-problem-solving');
  assert.equal(s.task.timeboxMinutes, 20);
  assert.equal(s.task.timeboxEnforced, false);
  assert.equal(SECTIONS.length, 4);
  assert.equal(Object.hasOwn(s, 'submission'), false);
  assert.equal(Object.hasOwn(s, 'analysis'), false);
});

test('all headline metrics recompute from the ten integer source records', () => {
  const { dataset } = createSeed();
  assert.equal(dataset.records.length, 10);
  assert.equal(new Set(dataset.records.map(r => r.id)).size, 10);
  for (const r of dataset.records) {
    for (const key of ['sessions', 'orders', 'adSpendCents', 'revenueCents']) assert.ok(Number.isSafeInteger(r[key]) && r[key] >= 0);
    assert.ok(r.orders <= r.sessions);
  }
  assert.deepEqual(aggregateDataset(dataset.records), dataset.metrics);
  assert.deepEqual(dataset.metrics.previous, { sessions: 1000000, orders: 34000, adSpendCents: 4173913, revenueCents: 102000000, conversionPct: 3.4 });
  assert.deepEqual(dataset.metrics.current, { sessions: 1180000, orders: 30680, adSpendCents: 4800000, revenueCents: 92040000, conversionPct: 2.6 });
  assert.equal(dataset.metrics.change.trafficPct, 18);
  assert.equal(dataset.metrics.change.adSpendPct.toFixed(2), '15.00');
  assert.equal(dataset.metrics.change.ordersPct.toFixed(2), '-9.76');
  assert.equal(dataset.metrics.change.conversionPercentagePoints.toFixed(1), '-0.8');
});

test('channel tables and period chart derive their rates and totals from the same populations', () => {
  const { dataset: d } = createSeed();
  assert.equal(d.channels.reduce((sum, c) => sum + c.traffic, 0), d.metrics.current.sessions);
  assert.equal(d.channels.reduce((sum, c) => sum + c.orders, 0), d.metrics.current.orders);
  assert.equal(d.channels.reduce((sum, c) => sum + c.revenue, 0), d.metrics.current.revenueCents / 100);
  for (const c of d.channels) {
    assert.equal(c.conversion, 100 * c.orders / c.traffic);
    assert.equal(c.previous, 100 * c.before.orders / c.before.sessions);
    assert.equal(c.growth, 100 * (c.traffic - c.before.sessions) / c.before.sessions);
  }
  const paid = d.channels.find(c => c.channel === 'Paid Search');
  assert.equal(paid.previous, 3.2); assert.equal(paid.conversion, 1.8); assert.equal(paid.growth, 42);
  assert.equal(paid.trafficSharePct.toFixed(2), '36.10');
  assert.ok(d.channels.every(c => paid.previous - paid.conversion >= c.previous - c.conversion));
  assert.deepEqual(d.trafficTrend.map(p => p.period), ['previous', 'current']);
  for (const point of d.trafficTrend) {
    assert.equal(point.sessions, d.metrics[point.period].sessions);
    assert.equal(point.traffic * 1000, point.sessions);
    assert.equal(point.conversion, 100 * point.orders / point.sessions);
  }
});

test('CSV content, row values, stable source ids and byte counts are internally consistent', () => {
  const s = createSeed(); const { resources, records } = s.dataset;
  assert.deepEqual(resources.map(r => r.id), ['website_traffic.csv', 'campaigns.csv', 'orders.csv', 'landing_pages.csv', 'product_catalog.csv', 'business_context.md']);
  assert.deepEqual(s.task.resourceIds, resources.map(r => r.id));
  for (const r of resources) {
    assert.equal(r.datasetVersion, DATASET_VERSION);
    assert.equal(r.provenance, 'synthetic');
    assert.equal(r.sizeBytes, Buffer.byteLength(r.content, 'utf8'));
    if (r.mimeType === 'text/csv') {
      const serialized = [r.columns, ...r.rows].map(row => row.map(cell => `"${cell.replaceAll('"', '""')}"`).join(',')).join('\r\n');
      assert.equal(r.content, serialized);
      assert.ok(r.rows.every(row => row.length === r.columns.length));
    }
  }
  const traffic = resources.find(r => r.id === 'website_traffic.csv');
  const orders = resources.find(r => r.id === 'orders.csv');
  assert.equal(traffic.rows.length, records.length);
  for (const r of records) {
    assert.deepEqual(traffic.rows.find(row => row[0] === r.id).slice(1, 5), [r.period, r.channel, String(r.sessions), String(r.orders)]);
    assert.equal(orders.rows.find(row => row[0] === r.id)[3], String(r.orders));
  }
});

test('current Paid Search device partition reconciles exactly and makes no page-speed claims', () => {
  const { dataset: d } = createSeed();
  const landing = d.resources.find(r => r.id === 'landing_pages.csv');
  const paid = d.channels.find(c => c.channel === 'Paid Search');
  assert.equal(landing.rows.reduce((sum, row) => sum + Number(row[4]), 0), paid.traffic);
  assert.equal(landing.rows.reduce((sum, row) => sum + Number(row[5]), 0), paid.orders);
  assert.equal(landing.rows[0][6], '1.400000');
  assert.equal(landing.rows[1][6], '2.752381');
  assert.equal(landing.columns.includes('load_time'), false);
  assert.match(d.resources.find(r => r.id === 'business_context.md').content, /not established causes/);
});

test('preset initial report citations exist verbatim and calculation table is reproducible', () => {
  const { application, job } = createSeed();
  for (const report of application.initialReport) {
    assert.ok(job.requirements.some(r => r.id === report.requirementId));
    assert.ok(report.uncertainty.length > 0);
    for (const ref of report.sourceRefs) {
      const source = application.sources.find(s => s.id === ref.sourceId);
      assert.ok(source, ref.sourceId);
      assert.ok(source.content.includes(ref.quote), ref.quote);
      assert.ok(ref.locator);
    }
  }
  const content = application.sources.find(s => s.kind === 'calculation_table').content;
  assert.ok(content.includes(`${((13500 - 12000) / 12000 * 100).toFixed(2)}%`));
  assert.ok(content.includes(`${((15000 - 13500) / 13500 * 100).toFixed(2)}%`));
});

test('reset seed is deterministic, detached and contains no private draft field', () => {
  const first = createSeed(); const second = createSeed();
  assert.deepEqual(first, second);
  first.dataset.records[0].orders = 1;
  first.application.initialReport[0].status = 'changed';
  assert.notDeepEqual(first, second);
  assert.deepEqual(second, createSeed());
  const inspect = value => {
    if (value && typeof value === 'object') {
      assert.equal(Object.hasOwn(value, 'notes'), false);
      Object.values(value).forEach(inspect);
    }
  };
  inspect(second);
});
