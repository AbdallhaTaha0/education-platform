/**
 * Negative + positive guard checks for the playback-recovery cleanup
 * ownership rules. Pure JSON payloads — no Docker daemon required.
 * Run: node --test docker/playback-recovery-review/guards.test.mjs
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  GuardError,
  expectedMountFromConfig,
  actualMountFromInspect,
  checkContainerMounts,
  checkContainerIdentity,
  checkVolumeIdentity,
  checkNetworkMembers,
  checkNoUnexpectedVolumes,
} from './guards.mjs';

const volumeMount = { type: 'volume', source: 'proj_pg', target: '/var/lib/postgresql/data', read_only: false };
const bindMount = { type: 'bind', source: '/host/evidence', target: '/evidence', read_only: false };
const inspectVolume = { Type: 'volume', Name: 'proj_pg', Destination: '/var/lib/postgresql/data', RW: true };
const inspectBind = { Type: 'bind', Source: '/host/evidence', Destination: '/evidence', RW: true };

describe('mount normalization', () => {
  it('maps compose and inspect shapes to one compared form', () => {
    assert.deepEqual(expectedMountFromConfig(volumeMount), {
      type: 'volume', source: 'proj_pg', destination: '/var/lib/postgresql/data', mode: 'rw',
    });
    assert.deepEqual(actualMountFromInspect(inspectVolume), {
      type: 'volume', source: 'proj_pg', destination: '/var/lib/postgresql/data', mode: 'rw',
    });
    assert.deepEqual(actualMountFromInspect({ ...inspectBind, RW: false }).mode, 'ro');
  });
});

describe('checkContainerMounts', () => {
  it('accepts exact volume and bind mappings', () => {
    checkContainerMounts('postgres', [inspectVolume], [volumeMount]);
    checkContainerMounts('runner', [inspectBind], [bindMount]);
    checkContainerMounts('bare', [], []);
  });

  it('refuses a wrong-source bind at an allowed destination', () => {
    assert.throws(
      () => checkContainerMounts('runner', [{ ...inspectBind, Source: '/etc/passwd' }], [bindMount]),
      (e) => e instanceof GuardError && /unexpected mount/.test(e.message),
    );
  });

  it('refuses a wrong service-volume mapping', () => {
    assert.throws(
      () => checkContainerMounts('redis', [{ ...inspectVolume, Name: 'proj_pg' }], [{ ...volumeMount, source: 'proj_redis' }]),
      (e) => e instanceof GuardError && /unexpected mount/.test(e.message),
    );
  });

  it('refuses mode flips and count differences', () => {
    assert.throws(
      () => checkContainerMounts('runner', [{ ...inspectBind, RW: false }], [bindMount]),
      (e) => e instanceof GuardError && /unexpected mount/.test(e.message),
    );
    assert.throws(
      () => checkContainerMounts('postgres', [inspectVolume, inspectBind], [volumeMount]),
      (e) => e instanceof GuardError && /count mismatch/.test(e.message),
    );
    assert.throws(
      () => checkContainerMounts('postgres', [], [volumeMount]),
      (e) => e instanceof GuardError && /count mismatch/.test(e.message),
    );
  });
});

describe('checkContainerIdentity', () => {
  const labels = { 'com.docker.compose.project': 'proj', 'com.docker.compose.service': 'server' };
  it('accepts exact image and labels', () => {
    checkContainerIdentity('abc', labels, 'img:tag', { project: 'proj', service: 'server', image: 'img:tag' });
  });

  it('refuses substring images, foreign projects and foreign services', () => {
    assert.throws(
      () => checkContainerIdentity('abc', labels, 'img:tag-patched', { project: 'proj', service: 'server', image: 'img:tag' }),
      GuardError,
    );
    assert.throws(
      () => checkContainerIdentity('abc', { ...labels, 'com.docker.compose.project': 'other' }, 'img:tag', { project: 'proj', service: 'server', image: 'img:tag' }),
      GuardError,
    );
    assert.throws(
      () => checkContainerIdentity('abc', { ...labels, 'com.docker.compose.service': 'db' }, 'img:tag', { project: 'proj', service: 'server', image: 'img:tag' }),
      GuardError,
    );
  });
});

describe('checkVolumeIdentity', () => {
  it('accepts a labeled owned volume and refuses foreign labels or renames', () => {
    checkVolumeIdentity('proj_pg', { Name: 'proj_pg', Labels: { 'com.docker.compose.project': 'proj' } }, 'proj');
    assert.throws(
      () => checkVolumeIdentity('proj_pg', { Name: 'proj_pg', Labels: { 'com.docker.compose.project': 'other' } }, 'proj'),
      GuardError,
    );
    assert.throws(
      () => checkVolumeIdentity('proj_pg', { Name: 'proj_other', Labels: { 'com.docker.compose.project': 'proj' } }, 'proj'),
      GuardError,
    );
  });
});

describe('checkNetworkMembers', () => {
  it('accepts owned-only members and refuses unrelated consumers or foreign networks', () => {
    const members = checkNetworkMembers(
      'net',
      { Labels: { 'com.docker.compose.project': 'proj' }, Containers: { aaa: {}, bbb: {} } },
      ['aaa', 'bbb', 'ccc'],
      'proj',
    );
    assert.deepEqual(members, ['aaa', 'bbb']);
    // Short ps ids match full inspection keys by prefix in either direction.
    checkNetworkMembers(
      'net',
      { Labels: { 'com.docker.compose.project': 'proj' }, Containers: { aaabbbcccdddeefff: {} } },
      ['aaabbbcccddd'],
      'proj',
    );
    assert.throws(
      () => checkNetworkMembers(
        'net',
        { Labels: { 'com.docker.compose.project': 'proj' }, Containers: { aaa: {}, evil: {} } },
        ['aaa', 'bbb'],
        'proj',
      ),
      (e) => e instanceof GuardError && /unrelated consumer/.test(e.message),
    );
    assert.throws(
      () => checkNetworkMembers('net', { Labels: {}, Containers: {} }, [], 'proj'),
      GuardError,
    );
  });
});

describe('checkNoUnexpectedVolumes', () => {
  it('passes exact sets and refuses anonymous hex volumes', () => {
    checkNoUnexpectedVolumes(['proj_pg'], ['proj_pg', 'proj_redis']);
    assert.throws(
      () => checkNoUnexpectedVolumes(['proj_pg', 'a3f9c21e7b4d4a8f9c0d1e2f3a4b5c6d7e8f90a1b2c3d4e5f6a7b8c9d0'], ['proj_pg']),
      (e) => e instanceof GuardError && /unexpected volume/.test(e.message),
    );
  });
});
