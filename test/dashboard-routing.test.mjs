import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DASHBOARD_VIEW_IDS,
  dashboardViewFromHash,
  dashboardViewHref
} from '../docs/dashboard-routing.js';

test('dashboard tabs expose stable hash links while overview stays at the root', () => {
  assert.equal(dashboardViewHref('overview'), './');
  assert.ok(DASHBOARD_VIEW_IDS.includes('story'));

  for (const viewId of DASHBOARD_VIEW_IDS.filter(id => id !== 'overview')) {
    assert.equal(dashboardViewHref(viewId), '#' + viewId);
    assert.equal(dashboardViewFromHash('#' + viewId), viewId);
  }
});

test('unknown or malformed dashboard hashes safely fall back to overview', () => {
  assert.equal(dashboardViewFromHash(''), 'overview');
  assert.equal(dashboardViewFromHash('#unknown'), 'overview');
  assert.equal(dashboardViewFromHash('#%E0%A4%A'), 'overview');
});
