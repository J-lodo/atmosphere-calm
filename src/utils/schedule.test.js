const test = require('node:test');
const assert = require('node:assert/strict');
const { readSchedule, isValidTimeZone } = require('./schedule');

test('un fuseau IANA est accepté', () => {
  assert.equal(isValidTimeZone('Africa/Kinshasa'), true);
  assert.equal(isValidTimeZone('PasUnFuseau'), false);
});

test('la fin doit être après le début', () => {
  assert.throws(() => readSchedule({
    startsAt: '2026-06-15T17:30:00.000Z',
    endsAt: '2026-06-15T17:00:00.000Z',
    timezone: 'Africa/Kinshasa',
  }), /fin/);
});

test('une date exige un fuseau', () => {
  assert.throws(() => readSchedule({
    startsAt: '2026-06-15T17:30:00.000Z',
    endsAt: null,
    timezone: '',
  }), /fuseau/);
});

test('sans date, le fuseau est vidé', () => {
  assert.deepEqual(readSchedule({ startsAt: null, endsAt: '', timezone: 'UTC' }), {
    startsAt: null,
    endsAt: null,
    timezone: '',
  });
});
