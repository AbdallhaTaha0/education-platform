/**
 * Fail-closed cleanup ownership guards for the playback-recovery harness.
 *
 * Pure functions over `docker inspect` / `docker compose config` JSON — no
 * Docker calls here, so every rule is unit-testable (see guards.test.mjs)
 * including negative cases. Every mismatch throws; callers must abort
 * removal for that project. A printed message alone is never an inspection.
 */

export class GuardError extends Error {
  constructor(message) {
    super(message);
    this.name = 'GuardError';
  }
}

function fail(message) {
  throw new GuardError(message);
}

/**
 * Normalize one compose-config volume entry to the compared shape.
 * Compose reports `{type, source, target, read_only}`; inspect reports
 * `{Type, Name|Source, Destination, RW}`.
 */
export function expectedMountFromConfig(entry) {
  if (!entry || typeof entry !== 'object') fail('compose mount entry is not an object');
  const { type, source, target, read_only } = entry;
  if (type !== 'volume' && type !== 'bind') fail(`unexpected compose mount type ${String(type)}`);
  if (typeof target !== 'string' || target.length === 0) fail('compose mount is missing a destination');
  if (type === 'volume' && (typeof source !== 'string' || source.length === 0)) {
    fail('compose volume mount is missing a source name');
  }
  if (type === 'bind' && (typeof source !== 'string' || source.length === 0)) {
    fail('compose bind mount is missing a source path');
  }
  return { type, source, destination: target, mode: read_only ? 'ro' : 'rw' };
}

export function actualMountFromInspect(mount) {
  if (!mount || typeof mount !== 'object') fail('inspect mount is not an object');
  const { Type, Name, Source, Destination, RW } = mount;
  if (Type !== 'volume' && Type !== 'bind') fail(`unexpected inspect mount type ${String(Type)}`);
  if (typeof Destination !== 'string' || Destination.length === 0) fail('inspect mount is missing a destination');
  const source = Type === 'volume' ? Name : Source;
  if (typeof source !== 'string' || source.length === 0) fail('inspect mount is missing a source identity');
  return { type: Type, source, destination: Destination, mode: RW ? 'rw' : 'ro' };
}

/**
 * Exact per-service mount check: same count, and every actual mount matches
 * exactly one expected mount on source, destination, type AND mode. A
 * wrong-source bind at an allowed destination, a wrong service-volume
 * mapping, a mode flip, or a count difference all abort removal.
 */
export function checkContainerMounts(serviceName, actualMounts, expectedMounts) {
  const actual = (actualMounts ?? []).map(actualMountFromInspect);
  const expected = (expectedMounts ?? []).map(expectedMountFromConfig);
  if (actual.length !== expected.length) {
    fail(`mount count mismatch on ${serviceName}: expected ${expected.length}, found ${actual.length}`);
  }
  const remaining = [...expected];
  for (const a of actual) {
    const i = remaining.findIndex(
      (e) => e.type === a.type && e.source === a.source && e.destination === a.destination && e.mode === a.mode,
    );
    if (i < 0) {
      fail(`unexpected mount on ${serviceName}: ${a.type} ${a.source} -> ${a.destination} (${a.mode})`);
    }
    remaining.splice(i, 1);
  }
}

/**
 * Exact container identity: project label, service label, and the image
 * reference the container was created from must equal the compose
 * configuration exactly (substring matches are refused).
 */
export function checkContainerIdentity(containerId, labels, configImage, expected) {
  if (!labels || typeof labels !== 'object') fail(`container ${containerId} has no labels`);
  if (labels['com.docker.compose.project'] !== expected.project) {
    fail(`container ${containerId} is not owned by ${expected.project}`);
  }
  if (labels['com.docker.compose.service'] !== expected.service) {
    fail(`container ${containerId} is not service ${expected.service}`);
  }
  if (configImage !== expected.image) {
    fail(`container ${containerId} image ${String(configImage)} does not equal expected ${expected.image}`);
  }
}

/**
 * Volume identity: the inspected volume's compose-project label and name
 * must match the expected owned volume exactly.
 */
export function checkVolumeIdentity(volumeName, volumeInspect, expectedProject) {
  const labels = volumeInspect?.Labels ?? {};
  if (volumeInspect?.Name !== volumeName) {
    fail(`volume identity mismatch: inspected ${String(volumeInspect?.Name)} is not ${volumeName}`);
  }
  if (labels['com.docker.compose.project'] !== expectedProject) {
    fail(`volume ${volumeName} is not owned by ${expectedProject}`);
  }
}

/**
 * Network membership: the network must carry this project's label, and every
 * attached container must be an owned container id. `docker ps -q` reports
 * short ids while network inspection keys full ids, so membership compares
 * by prefix in either direction. An unrelated consumer aborts removal.
 */
export function checkNetworkMembers(networkName, networkInspect, ownedContainerIds, expectedProject) {
  const labels = networkInspect?.Labels ?? {};
  if (labels['com.docker.compose.project'] !== expectedProject) {
    fail(`network ${networkName} is not owned by ${expectedProject}`);
  }
  const members = Object.keys(networkInspect?.Containers ?? {});
  for (const member of members) {
    const owned = ownedContainerIds.some((id) => member.startsWith(id) || id.startsWith(member));
    if (!owned) {
      fail(`network ${networkName} has unrelated consumer ${member}`);
    }
  }
  return members;
}

/**
 * Anonymous-volume sweep: every volume name mounted by owned containers must
 * be an expected named volume. Docker-generated hex names (or anything else
 * outside the expected set) abort removal instead of being silently dropped.
 */
export function checkNoUnexpectedVolumes(mountedVolumeNames, expectedVolumeNames) {
  for (const name of mountedVolumeNames) {
    if (!expectedVolumeNames.includes(name)) {
      fail(`unexpected volume ${name} mounted by an owned container`);
    }
  }
}
