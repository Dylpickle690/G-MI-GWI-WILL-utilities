import assert from 'node:assert/strict';
import test from 'node:test';
import { buildSessionEmbed, validateHttpsUrl } from '../src/services/sessionService.js';

test('session URLs must use HTTPS and are normalized', () => {
  assert.equal(validateHttpsUrl('https://example.com/join', 'Join link'), 'https://example.com/join');
  assert.throws(() => validateHttpsUrl('http://example.com', 'Join link'), /must use HTTPS/);
  assert.throws(() => validateHttpsUrl('not a URL', 'Banner link'), /valid HTTPS URL/);
});

test('session panel reflects configured Washington RP schedule and live state', () => {
  const embed = buildSessionEmbed({
    schedule: 'Fridays at 7 PM Pacific',
    status: 'active',
    startedAt: '2026-11-02T18:00:00.000Z',
    joinUrl: 'https://example.com/join',
    bannerUrl: 'https://example.com/banner.png',
  }).toJSON();

  assert.match(embed.title, /Washington State RP/);
  assert.match(embed.description, /Fridays at 7 PM Pacific/);
  assert.match(embed.description, /SESSION IN PROGRESS/);
  assert.match(embed.description, /https:\/\/example\.com\/join/);
  assert.equal(embed.image.url, 'https://example.com/banner.png');
  assert.equal(embed.timestamp, '2026-11-02T18:00:00.000Z');
});

test('session panel defaults to an offline status without claiming a start time', () => {
  const embed = buildSessionEmbed({
    schedule: 'Schedule is set by server staff',
    status: 'offline',
    startedAt: null,
    joinUrl: 'https://example.com/join',
  }).toJSON();

  assert.match(embed.description, /NO ACTIVE SESSION/);
  assert.doesNotMatch(embed.description, /Last started/);
  assert.equal(embed.image, undefined);
});
