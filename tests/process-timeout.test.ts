import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import test from 'node:test';
import {
  createProcessRunner,
  type ProcessRunnerDependencies,
  type SpawnedProcess,
} from '../src/electron/processRunner';

const MAX_OUTPUT_BYTES = 10 * 1024 * 1024;

class FakeProcess extends EventEmitter {
  readonly stdout = new EventEmitter();
  readonly stderr = new EventEmitter();
  killCalls = 0;

  constructor(readonly pid?: number) {
    super();
  }

  kill() {
    this.killCalls += 1;
    return true;
  }
}

interface FakeTimer {
  callback: () => void;
  delayMs: number;
  cleared: boolean;
}

const createHarness = () => {
  const operation = new FakeProcess(4321);
  const taskkill = new FakeProcess(9876);
  const spawns: Array<{ command: string; args: string[] }> = [];
  const timers: FakeTimer[] = [];

  const dependencies: ProcessRunnerDependencies = {
    spawnProcess: (command, args) => {
      spawns.push({ command, args });
      return (spawns.length === 1 ? operation : taskkill) as unknown as SpawnedProcess;
    },
    setTimer: (callback, delayMs) => {
      const timer = { callback, delayMs, cleared: false };
      timers.push(timer);
      return timer;
    },
    clearTimer: (timer) => {
      (timer as FakeTimer).cleared = true;
    },
  };

  return { operation, taskkill, spawns, timers, dependencies };
};

const startTimedOperation = () => {
  const harness = createHarness();
  const runProcess = createProcessRunner(1_000, harness.dependencies);
  const resultPromise = runProcess('powershell.exe', ['-File', 'operation.ps1'], 'C:\\private');
  harness.operation.emit('spawn');
  return { ...harness, resultPromise };
};

test('taskkill error uses the outer-process fallback and settles exactly once', async () => {
  const { operation, taskkill, spawns, timers, resultPromise } = startTimedOperation();
  let settlements = 0;
  void resultPromise.then(() => { settlements += 1; });

  operation.stdout.emit('data', Buffer.from('partial stdout'));
  operation.stderr.emit('data', Buffer.from('partial stderr'));
  timers[0].callback();

  assert.deepEqual(spawns[1], {
    command: 'taskkill.exe',
    args: ['/PID', '4321', '/T', '/F'],
  });
  taskkill.emit('error', new Error('taskkill failed'));

  assert.deepEqual(await resultPromise, {
    exitCode: null,
    stdout: 'partial stdout',
    stderr: 'partial stderr',
    timedOut: true,
    outputLimitExceeded: false,
  });
  assert.equal(operation.killCalls, 1);
  assert.equal(taskkill.killCalls, 0);
  assert.ok(timers.every((timer) => timer.cleared));

  taskkill.emit('close', 0);
  operation.emit('close', 0);
  timers[1].callback();
  await Promise.resolve();
  assert.equal(settlements, 1);
  assert.equal(operation.killCalls, 1);
});

test('taskkill deadline kills taskkill and uses the outer-process fallback', async () => {
  const { operation, taskkill, timers, resultPromise } = startTimedOperation();

  timers[0].callback();
  assert.equal(timers[1].delayMs, 5_000);
  timers[1].callback();

  const result = await resultPromise;
  assert.equal(result.timedOut, true);
  assert.equal(taskkill.killCalls, 1);
  assert.equal(operation.killCalls, 1);
  assert.ok(timers.every((timer) => timer.cleared));

  taskkill.emit('close', 0);
  operation.emit('close', 0);
  assert.equal(taskkill.killCalls, 1);
  assert.equal(operation.killCalls, 1);
});

test('normal taskkill close settles without weakening full-tree termination', async () => {
  const { operation, taskkill, timers, resultPromise } = startTimedOperation();

  timers[0].callback();
  taskkill.emit('close', 0);

  assert.equal((await resultPromise).timedOut, true);
  assert.equal(operation.killCalls, 0);
  assert.equal(taskkill.killCalls, 0);
  assert.ok(timers.every((timer) => timer.cleared));
});

test('output cap after launch uses full-tree termination and returns bounded output', async () => {
  const { operation, taskkill, spawns, timers, resultPromise } = startTimedOperation();
  let settlements = 0;
  void resultPromise.then(() => { settlements += 1; });

  operation.stderr.emit('data', Buffer.from('warning'));
  operation.stdout.emit('data', Buffer.alloc(MAX_OUTPUT_BYTES, 97));

  assert.equal(spawns[1]?.command, 'taskkill.exe');
  assert.equal(timers[0].cleared, true, 'the operation deadline clears when termination starts');
  taskkill.emit('close', 0);

  const result = await resultPromise;
  assert.equal(result.exitCode, null);
  assert.equal(result.timedOut, false);
  assert.equal(result.outputLimitExceeded, true);
  assert.equal(result.stderr, 'warning');
  assert.equal(Buffer.byteLength(result.stdout) + Buffer.byteLength(result.stderr), MAX_OUTPUT_BYTES);
  assert.equal(operation.killCalls, 0);
  assert.ok(timers.every((timer) => timer.cleared));

  operation.emit('error', new Error('late operation error'));
  operation.emit('close', 1);
  taskkill.emit('error', new Error('late taskkill error'));
  timers[0].callback();
  timers[1].callback();
  await Promise.resolve();
  assert.equal(settlements, 1);
  assert.equal(spawns.length, 2);
});
